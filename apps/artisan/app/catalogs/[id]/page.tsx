import { notFound } from 'next/navigation';
import { CatalogWizard } from '../../../components/catalog-wizard';

export default async function CatalogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) notFound();
  return <CatalogWizard id={id} key={id} />;
}
