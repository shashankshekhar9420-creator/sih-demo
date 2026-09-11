import Link from 'next/link';
import { Camera, Mic, PencilLine, Store } from 'lucide-react';
import { DemoNotice } from '../../components/ui';

export default function GuidePage() {
  return <div className="guide-page"><span className="eyebrow">A HELPING HAND</span><h1>Your craft, one step at a time.</h1><p className="lede">You don&apos;t need to be a writer or a photographer. Start with what you make.</p><div className="guide-grid">{[
    { icon: Camera, title: '01. Find the light', text: 'Place your product near a window on a plain surface. Take exactly three JPG or PNG photos: the whole product, a side or detail, and its texture. Keep each photo under 10 MB.' },
    { icon: Mic, title: '02. Speak naturally', text: 'Answer each of the three Hindi questions. Tell us the name and material, how it is made, and its use or story. Allow microphone access, or upload an audio file for each question (up to 20 MB).' },
    { icon: PencilLine, title: '03. Make it accurate', text: 'Choose a category, generate a draft, enter your making cost, and set your stock. Review the English and Hindi text, product details, and final price. Replace demo text with verified facts.' },
    { icon: Store, title: '04. Share your work', text: 'Publish your reviewed catalog to the marketplace. If the connection fails, your work stays saved and you can retry. Open any existing catalog to edit it and publish updates to the same listing.' },
  ].map(({ icon: Icon, title, text }) => <article className="panel" key={title}><Icon size={29} strokeWidth={1.4} /><h2>{title}</h2><p>{text}</p></article>)}</div><DemoNotice>Backgrounds are removed to clean white studio backgrounds. Transcripts and catalog generation are deterministic placeholders, not real AI. The suggested price is twice your entered making cost, not market research. Orders use demo payments.</DemoNotice><Link href="/catalogs/new" className="button primary">Create your first catalog</Link></div>;
}
