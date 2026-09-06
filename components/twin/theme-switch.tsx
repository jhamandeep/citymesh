'use client';
/* Browser-local preference is restored after hydration. */
/* oxlint-disable react/react-compiler */
import {useEffect,useState} from 'react';
import {Sun,Moon} from 'lucide-react';
export default function ThemeSwitch(){
 const [theme,setTheme]=useState('dark');
 useEffect(()=>{try{const saved=localStorage.getItem('citymesh-theme');const next=saved==='light'?'light':'dark';setTheme(next);document.body.classList.toggle('neo-theme',next==='dark');document.body.classList.toggle('light-theme',next==='light');}catch{}},[]);
 const choose=(next:string)=>{setTheme(next);document.body.classList.toggle('neo-theme',next==='dark');document.body.classList.toggle('light-theme',next==='light');try{localStorage.setItem('citymesh-theme',next);}catch{}};
 return <div className="theme-switch" aria-label="Color theme">{['light','dark'].map(value=><button type="button" key={value} aria-label={`${value==='light'?'Light':'Dark'} theme`} aria-pressed={theme===value} onClick={()=>choose(value)}>{value==='light'?<Sun size={15}/>:<Moon size={15}/>}<span>{value==='light'?'Light':'Dark'}</span></button>)}</div>;
}

