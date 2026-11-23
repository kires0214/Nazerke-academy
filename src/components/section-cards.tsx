import Link from 'next/link';

export type SectionLink={href:string;label:string;summary?:string};

export function SectionCards({links,label}:{links:SectionLink[];label:string}) {
  return <nav className="section-cards" aria-label={label}>
    {links.map(link=><Link key={link.href} href={link.href} className="section-card">
      <div><strong>{link.label}</strong>{link.summary?<span>{link.summary}</span>:null}</div>
      <span className="section-card-arrow" aria-hidden="true">→</span>
    </Link>)}
  </nav>;
}
