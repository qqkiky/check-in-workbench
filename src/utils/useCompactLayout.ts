import { useEffect, useState } from 'react'

// Observe the actual app area, including changes to camera/system insets.
export function useCompactLayout() {
  const [compact,setCompact]=useState(false)
  useEffect(()=>{
    const root=document.getElementById('root')
    if(!root)return
    const update=()=>{
      const style=getComputedStyle(root)
      const width=root.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)
      const height=root.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom)
      setCompact(width<=360&&height<=650)
    }
    const observer=new ResizeObserver(update);observer.observe(root);update()
    return ()=>observer.disconnect()
  },[])
  return compact
}
