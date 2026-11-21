'use client';
import { useEffect,useRef } from 'react';
import { usePathname } from 'next/navigation';

export function ActivityTracker() {
  const path=usePathname();
  const previous=useRef<string|undefined>(undefined);
  useEffect(()=>{
    if(!path||previous.current===path)return;
    previous.current=path;
    void fetch('/api/activity',{
      method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({path}),
    }).catch(()=>{});
  },[path]);
  return null;
}
