import { Camera, Mic, Store } from 'lucide-react';
import { CreateCatalogButton } from '../../../components/create-catalog';
import { CraftIllustration, DemoNotice } from '../../../components/ui';

export default function NewCatalogPage() {
  return <div className="new-catalog-page"><span className="eyebrow">A NEW BEGINNING</span><h1>Let your craft do the talking.</h1><p className="lede">One handmade product. A few simple steps. A whole new possibility.</p><div className="new-catalog-card"><div><h2>Bring your creation to life.</h2><ol className="intro-steps"><li><Camera /><div><strong>Take 3 photographs</strong><span>A full view, a detail, and a close-up.</span></div></li><li><Mic /><div><strong>Tell us its story</strong><span>Answer 3 questions in your own voice.</span></div></li><li><Store /><div><strong>Make it yours, then publish</strong><span>Review every detail, set a price, and share.</span></div></li></ol><CreateCatalogButton label="Let's begin" /><p className="fine-print">Each completed step is saved. Come back whenever you like.</p></div><CraftIllustration /></div><DemoNotice>This is a working prototype. Image processing removes backgrounds to pure white, voice results and generated text are placeholders, and pricing uses a simple formula. You stay in control of what gets published.</DemoNotice></div>;
}
