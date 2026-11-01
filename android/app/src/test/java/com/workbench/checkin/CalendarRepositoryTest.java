package com.workbench.checkin;

import android.app.Application;
import android.content.ContentProvider;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Context;
import android.content.pm.ProviderInfo;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.provider.CalendarContract;
import android.provider.CalendarContract.Events;
import android.provider.CalendarContract.Calendars;
import android.provider.CalendarContract.Reminders;
import java.util.Map;
import java.util.HashMap;
import java.util.Set;
import java.util.HashSet;
import java.util.Collections;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowContentResolver;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=34,application=Application.class,manifest=Config.NONE)
public class CalendarRepositoryTest {
    private Context context;
    private FakeCalendar provider;
    private CalendarRepository repository;
    @Before public void setup() {
        context=RuntimeEnvironment.getApplication();provider=new FakeCalendar();
        ProviderInfo info=new ProviderInfo();info.authority=CalendarContract.AUTHORITY;
        provider.attachInfo(context,info);ShadowContentResolver.registerProviderInternal(CalendarContract.AUTHORITY,provider);
        repository=new CalendarRepository(context);
    }
    private long add(String key) throws Exception {return repository.upsertEvent(key,"demo",1000000,2000000,0,"",false,true);}

    @Test public void deletedEventIsNotRecreatedByForegroundOrBackgroundUpsert() throws Exception {
        String key="one@2026-11-02";long id=add(key);provider.events.remove(id);
        assertEquals(key,repository.collectDeletions().getString(0));
        assertEquals(0,add(key));assertEquals(1,provider.inserts);assertFalse(provider.events.containsKey(id));
        assertEquals(key,repository.collectDeletions().getString(0));
    }
    @Test public void softDeletedEventAlsoBecomesADeletion() throws Exception {
        String key="habit@2026-11-02";long id=add(key);provider.events.get(id).put(Events.DELETED,1);
        assertEquals(key,repository.collectDeletions().getString(0));assertEquals(0,add(key));
        assertTrue(add("habit@2026-11-03")>0);
    }
    @Test public void emptyFullSnapshotRemovesOnlyTrackedEventsInOwnedCalendars() throws Exception {
        long own=add("one@2026-11-02"),other=add("two@2026-11-02");
        ContentValues foreign=new ContentValues();foreign.put(Events._ID,900L);foreign.put(Events.CALENDAR_ID,2L);foreign.put(Events.DELETED,0);foreign.put(Events.TITLE,"personal");provider.events.put(900L,foreign);
        context.getSharedPreferences("calendar-events",0).edit().putLong("stale-foreign",900L).commit();
        assertEquals(2,repository.pruneTasks(Collections.emptySet()));assertFalse(provider.events.containsKey(own));assertFalse(provider.events.containsKey(other));
        assertEquals("personal",provider.events.get(900L).getAsString(Events.TITLE));assertFalse(provider.reminders.contains(own));assertEquals(0,repository.collectDeletions().length());
    }
    @Test public void removedTaskCannotBeResurrectedByAnOlderBackgroundSnapshot() throws Exception {
        String key="one@2026-11-02";add(key);repository.blockTask("one");repository.deleteEvent(key);
        assertEquals(0,add(key));repository.allowTask(key);assertTrue(add(key)>0);
    }
    @Test public void unavailableProviderDoesNotBecomeUserDeletion() throws Exception {
        add("one@2026-11-02");provider.failQueries=true;
        assertThrows(Exception.class,()->repository.collectDeletions());
        assertTrue(context.getSharedPreferences("calendar-deletions",0).getAll().isEmpty());assertEquals(1,provider.events.size());
    }
    @Test public void missingWholeCalendarDoesNotDeleteEveryWorkbenchTask() throws Exception {
        add("one@2026-11-02");provider.calendarExists=false;provider.events.clear();
        assertThrows(Exception.class,()->repository.collectDeletions());assertTrue(context.getSharedPreferences("calendar-deletions",0).getAll().isEmpty());
    }
    @Test public void unsavedCloudArrivalSurvivesLocalPruningUntilImported() throws Exception {
        String key="remote@2026-11-02";long id=add(key);repository.markCloudOnly("remote");
        assertEquals(0,repository.pruneTasks(Collections.emptySet()));assertTrue(provider.events.containsKey(id));
        repository.pruneTasks(Collections.singleton("remote"));assertEquals(1,repository.pruneTasks(Collections.emptySet()));
    }
    @Test public void existingEventIsUpdatedInPlaceAndVisibilityIsNotDeletion() throws Exception {
        String key="one@2026-11-02";long id=add(key);provider.visible=false;
        assertEquals(0,repository.collectDeletions().length());assertEquals(id,repository.upsertEvent(key,"done",1000000,2000000,0,"",true,false));
        assertEquals("✅ 已完成｜done",provider.events.get(id).getAsString(Events.TITLE));assertFalse(provider.reminders.contains(id));
    }

    public static class FakeCalendar extends ContentProvider {
        final Map<Long,ContentValues> events=new HashMap<>();final Set<Long> reminders=new HashSet<>();
        boolean calendarExists=true,visible=true,failQueries;long next=100;int inserts;
        @Override public boolean onCreate(){return true;}
        @Override public Cursor query(Uri uri,String[] projection,String selection,String[] args,String order) {
            if(failQueries)return null;
            MatrixCursor result=new MatrixCursor(projection);
            if(uri.getPath().startsWith("/calendars")){
                if(!visible&&selection!=null&&selection.contains(Calendars.VISIBLE))return result;
                if(calendarExists){Object[] row=new Object[projection.length];for(int i=0;i<projection.length;i++){String column=projection[i];row[i]=column.equals(Calendars._ID)?1L:column.equals(Calendars.ACCOUNT_NAME)?"打卡工作台":CalendarContract.ACCOUNT_TYPE_LOCAL;}result.addRow(row);}
            }else if(uri.getPath().startsWith("/events")){
                ContentValues value=events.get(Long.parseLong(args[0]));
                if(value!=null){Object[] row=new Object[projection.length];for(int i=0;i<projection.length;i++)row[i]=value.get(projection[i]);result.addRow(row);}
            }
            return result;
        }
        @Override public Uri insert(Uri uri,ContentValues values) {
            if(uri.getPath().startsWith("/calendars")){calendarExists=true;return ContentUris.withAppendedId(Calendars.CONTENT_URI,1);}
            if(uri.getPath().startsWith("/reminders")){reminders.add(values.getAsLong(Reminders.EVENT_ID));return ContentUris.withAppendedId(Reminders.CONTENT_URI,1);}
            long id=next++;ContentValues value=new ContentValues(values);value.put(Events._ID,id);value.put(Events.DELETED,0);events.put(id,value);inserts++;return ContentUris.withAppendedId(Events.CONTENT_URI,id);
        }
        @Override public int update(Uri uri,ContentValues values,String selection,String[] args) {ContentValues value=events.get(Long.parseLong(args[0]));if(value==null)return 0;value.putAll(values);return 1;}
        @Override public int delete(Uri uri,String selection,String[] args) {long id=Long.parseLong(args[0]);return uri.getPath().startsWith("/reminders")?(reminders.remove(id)?1:0):(events.remove(id)!=null?1:0);}
        @Override public String getType(Uri uri){return null;}
    }
}
