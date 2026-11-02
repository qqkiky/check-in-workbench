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
import org.json.JSONArray;
import org.json.JSONObject;
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
    @Test public void editsInCalendarAreReadBeforeAnAppWriteAndIdenticalWritesAreQuiet() throws Exception {
        String key="one@2026-11-02";long id=add(key);
        assertEquals(0,repository.collectChanges().length());assertEquals(id,add(key));assertEquals(0,provider.updates);
        provider.events.get(id).put(Events.TITLE,"changed in calendar");
        assertEquals("changed in calendar",repository.collectChanges().getJSONObject(0).getString("title"));
        repository.upsertEvent(key,"changed in calendar",1000000,2000000,0,"",false,true);
        assertEquals(0,repository.collectChanges().length());assertEquals(1,provider.updates);
    }
    @Test public void movingAnOccurrenceRebindsTheOriginalEventInsteadOfDuplicatingIt() throws Exception {
        long id=add("one@2026-11-02");repository.rebind("one@2026-11-02","one@2026-11-03",id);
        assertEquals(id,add("one@2026-11-03"));assertEquals(1,provider.inserts);
        assertFalse(context.getSharedPreferences("calendar-events",0).contains("one@2026-11-02"));
    }
    @Test public void appReschedulingSingleTaskUpdatesItsOriginalRow() throws Exception {
        long id=add("one@2026-11-02");
        assertEquals(id,repository.upsertEvent("one@2026-11-03","moved",3000000,4000000,0,"",false,true,false,true));
        assertEquals(1,provider.inserts);assertEquals(3000000L,provider.events.get(id).getAsLong(Events.DTSTART).longValue());
    }
    @Test public void selectedXiaoaiEventsImportInPlaceAndKeepOriginalCalendarAndNotes() throws Exception {
        ContentValues source=new ContentValues();source.put(Events._ID,900L);source.put(Events.CALENDAR_ID,2L);source.put(Events.TITLE,"from xiaoai");source.put(Events.DESCRIPTION,"private calendar note");
        long start=System.currentTimeMillis()+3600000;source.put(Events.DTSTART,start);source.put(Events.DTEND,start+1800000);source.put(Events.DELETED,0);source.put(Events.HAS_ALARM,0);provider.events.put(900L,source);
        assertEquals(0,repository.collectNewEvents().length());repository.selectCalendars(new JSONArray("[2]"));
        JSONObject incoming=repository.collectNewEvents().getJSONObject(0);String key=incoming.getString("key");
        assertEquals("from xiaoai",incoming.getString("title"));assertEquals(0,repository.pruneTasks(Collections.emptySet()));assertTrue(provider.events.containsKey(900L));
        assertFalse(incoming.has("description"));assertFalse(context.getSharedPreferences("calendar-snapshots",0).getString(key,"").contains("from xiaoai"));
        repository.allowTask(key);
        assertEquals(900L,repository.upsertEvent(key,"edited in app",start,start+1800000,0,"must not overwrite private notes",false,false,false,true));
        assertEquals(2L,provider.events.get(900L).getAsLong(Events.CALENDAR_ID).longValue());assertEquals("private calendar note",provider.events.get(900L).getAsString(Events.DESCRIPTION));
        assertEquals(0,repository.collectNewEvents().length());assertEquals(0,provider.inserts);
        provider.events.get(900L).put(Events.TITLE,"edited in calendar");assertEquals("edited in calendar",repository.collectChanges().getJSONObject(0).getString("title"));
        repository.selectCalendars(new JSONArray());assertEquals(0,repository.upsertEvent(key,"must not write deselected calendar",start,start+1800000,0,"",false,false));
        assertEquals("edited in calendar",provider.events.get(900L).getAsString(Events.TITLE));
    }
    @Test public void repeatAndPastEventsStayOutsideTheSingleEventImport() throws Exception {
        repository.selectCalendars(new JSONArray("[2]"));
        ContentValues repeat=new ContentValues();repeat.put(Events._ID,900L);repeat.put(Events.CALENDAR_ID,2L);repeat.put(Events.TITLE,"repeat");repeat.put(Events.DTSTART,System.currentTimeMillis()+3600000);repeat.put(Events.DTEND,System.currentTimeMillis()+7200000);repeat.put(Events.RRULE,"FREQ=DAILY");provider.events.put(900L,repeat);
        ContentValues past=new ContentValues(repeat);past.put(Events._ID,901L);past.remove(Events.RRULE);past.put(Events.DTSTART,1000L);past.put(Events.DTEND,2000L);provider.events.put(901L,past);
        assertEquals(0,repository.collectNewEvents().length());
    }
    @Test public void lostOwnMappingRestoresItsTaskKeyWithoutImportingADuplicate() throws Exception {
        long start=System.currentTimeMillis()+3600000;
        long id=repository.upsertEvent("one@2026-11-02","own",start,start+1800000,0,"来自打卡工作台",false,false);
        context.getSharedPreferences("calendar-events",0).edit().clear().commit();
        assertEquals(0,repository.collectNewEvents(Collections.singleton("one")).length());
        assertEquals(id,context.getSharedPreferences("calendar-events",0).getLong("one@2026-11-02",-1));
        assertEquals(1,provider.inserts);
    }

    public static class FakeCalendar extends ContentProvider {
        final Map<Long,ContentValues> events=new HashMap<>();final Set<Long> reminders=new HashSet<>();final Map<Long,Integer> reminderMinutes=new HashMap<>();
        boolean calendarExists=true,sourceExists=true,visible=true,failQueries;long next=100;int inserts,updates;
        @Override public boolean onCreate(){return true;}
        @Override public Cursor query(Uri uri,String[] projection,String selection,String[] args,String order) {
            if(failQueries)return null;
            MatrixCursor result=new MatrixCursor(projection);
            if(uri.getPath().startsWith("/calendars")){
                if(!visible&&selection!=null&&selection.contains(Calendars.VISIBLE))return result;
                for(long id:new long[]{1,2}){
                    if(id==1&&!calendarExists||id==2&&!sourceExists)continue;
                    if(selection!=null&&selection.contains(Calendars.ACCOUNT_NAME)&&id!=1)continue;
                    if((Calendars._ID+"=?").equals(selection)&&id!=Long.parseLong(args[0]))continue;
                    Object[] row=new Object[projection.length];for(int i=0;i<projection.length;i++){
                        String column=projection[i];row[i]=column.equals(Calendars._ID)?id:column.equals(Calendars.ACCOUNT_NAME)?(id==1?"打卡工作台":"local"):column.equals(Calendars.CALENDAR_ACCESS_LEVEL)?Calendars.CAL_ACCESS_OWNER:column.equals(Calendars.CALENDAR_DISPLAY_NAME)?(id==1?"期待":"手机日历"):CalendarContract.ACCOUNT_TYPE_LOCAL;
                    }result.addRow(row);
                }
            }else if(uri.getPath().startsWith("/events")){
                java.util.Collection<ContentValues> rows;
                if((Events._ID+"=?").equals(selection)){ContentValues value=events.get(Long.parseLong(args[0]));rows=value==null?Collections.emptyList():Collections.singletonList(value);}
                else rows=events.values();
                for(ContentValues value:rows){
                    if(selection!=null&&selection.contains(" IN ")){
                        if(!java.util.Arrays.asList(args).contains(value.getAsString(Events.CALENDAR_ID))||Integer.valueOf(1).equals(value.getAsInteger(Events.DELETED)))continue;
                        String repeat=value.getAsString(Events.RRULE);if(repeat!=null&&!repeat.isEmpty())continue;
                    }
                    Object[] row=new Object[projection.length];for(int i=0;i<projection.length;i++)row[i]=value.get(projection[i]);result.addRow(row);
                }
            }else if(uri.getPath().startsWith("/reminders")){
                long id=Long.parseLong(args[0]);if(reminders.contains(id))result.addRow(new Object[]{reminderMinutes.getOrDefault(id,0)});
            }
            return result;
        }
        @Override public Uri insert(Uri uri,ContentValues values) {
            if(uri.getPath().startsWith("/calendars")){calendarExists=true;return ContentUris.withAppendedId(Calendars.CONTENT_URI,1);}
            if(uri.getPath().startsWith("/reminders")){long id=values.getAsLong(Reminders.EVENT_ID);reminders.add(id);reminderMinutes.put(id,values.getAsInteger(Reminders.MINUTES));return ContentUris.withAppendedId(Reminders.CONTENT_URI,1);}
            long id=next++;ContentValues value=new ContentValues(values);value.put(Events._ID,id);value.put(Events.DELETED,0);events.put(id,value);inserts++;return ContentUris.withAppendedId(Events.CONTENT_URI,id);
        }
        @Override public int update(Uri uri,ContentValues values,String selection,String[] args) {ContentValues value=events.get(Long.parseLong(args[0]));if(value==null)return 0;value.putAll(values);updates++;return 1;}
        @Override public int delete(Uri uri,String selection,String[] args) {long id=Long.parseLong(args[0]);return uri.getPath().startsWith("/reminders")?(reminders.remove(id)?1:0):(events.remove(id)!=null?1:0);}
        @Override public String getType(Uri uri){return null;}
    }
}
