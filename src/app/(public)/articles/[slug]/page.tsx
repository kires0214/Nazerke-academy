import { notFound } from 'next/navigation';
import { publicArticles } from '@/components/public-content';
import { PageHead,Photo,RichText } from '@/components/cards';
export default async function Page({params}:{params:Promise<{slug:string}>}) {const {slug}=await params;const a=(await publicArticles()).find(x=>x.slug===slug);if(!a) notFound();return <article><PageHead title={a.title} description={a.description} kicker="Открытая статья"/>{a.image?<div className="article-photo"><Photo name={a.image} alt={a.title} priority/></div>:null}<RichText text={a.body}/></article>;}
