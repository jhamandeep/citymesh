import type {AnchorHTMLAttributes} from 'react';
/** Native navigation remounts the destination and reads its site/asset query. */
export default function SiteLink({children,...props}:AnchorHTMLAttributes<HTMLAnchorElement>){return <a {...props}>{children}</a>;}
