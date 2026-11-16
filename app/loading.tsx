import { EmberLoader } from '@/components/ui/ember-loader';

// Shown automatically by Next.js while a page is loading.
export default function Loading() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] w-full items-center justify-center">
      <EmberLoader label="Loading OrbinexaCSV" />
    </div>
  );
}
