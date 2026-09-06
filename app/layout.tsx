import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'Citymesh — Network Digital Twin',description:'Explore a small-city infrastructure model, simulate network disruptions, and understand connectivity impacts.'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>;}
