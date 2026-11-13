import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = { title: 'Terms of Service | OrbinexaCSV' };

const sections: { title: string; points: string[] }[] = [
  {
    title: '1. Using OrbinexaCSV',
    points: [
      'OrbinexaCSV helps stock contributors write titles, descriptions and keywords. You are responsible for checking the results before you upload them anywhere.',
      'You must follow the rules of the stock agency you upload to (Adobe Stock, Shutterstock, Freepik and others). We cannot promise that a file will be accepted.',
      'Only upload images that you own or have the right to use.',
      'Do not abuse the site: no fake accounts to collect free credits, no attacks, no automated misuse. We may limit or close accounts that do.',
    ],
  },
  {
    title: '2. Credits',
    points: [
      'Generating metadata costs credits (1 credit per image, and 1 credit to retitle). Free credits and bonus credits can change over time.',
      'Credits have no cash value and cannot be sold or transferred.',
    ],
  },
  {
    title: '3. Marketplace: how it works',
    points: [
      'The Marketplace is run by OrbinexaCSV. Vendors list digital products and subscriptions. Customers pay OrbinexaCSV only, never the vendor.',
      'The vendor starts work only after OrbinexaCSV confirms payment. OrbinexaCSV checks the order, then delivers it to the customer.',
      'Vendors are shown only by a brand name. Their real name and contact details are private.',
      'Every package shows its price, delivery time, warranty and details before you order. The details you saw when you ordered are saved with your order.',
      'Orders are placed through the site and finished on WhatsApp with OrbinexaCSV.',
    ],
  },
  {
    title: '4. Confirming, problems and refunds',
    points: [
      'After delivery you have a set time to check the product. The default is 6 hours. Confirm the order if all is well, or report a problem.',
      'If you do not answer within that time, the order is completed automatically.',
      'A reported problem is reviewed fairly by OrbinexaCSV. If the product was not delivered, or is not what the package promised, we will fix it, replace it or refund you. The final decision is made after we review the details from both sides.',
      'An unpaid order can be cancelled by you before payment is confirmed.',
    ],
  },
  {
    title: '5. Rules for vendors',
    points: [
      'Do not put phone numbers, email, links, social accounts or your real name in packages, warranty text or status posts. These are blocked and repeated attempts are reported to the admin.',
      'Deliver on time and describe your packages honestly. Package details lock for 1 hour after a change to protect customers.',
      'Selling fake, stolen or illegal products is not allowed. OrbinexaCSV may pause or remove a vendor at any time to protect customers.',
      'A vendor is paid after the order is completed.',
    ],
  },
  {
    title: '6. Our responsibility',
    points: [
      'We work to keep the site running and safe, but we cannot promise it will always be available or error-free.',
      'The site is in beta. Features, prices and rules may change. Important changes will be shown on the site.',
    ],
  },
  {
    title: '7. Contact',
    points: ['For any question or problem, contact OrbinexaCSV support on WhatsApp from the Marketplace page.'],
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex justify-center p-4 py-12 font-poppins">
      <div className="w-full max-w-2xl rounded-2xl border border-border/60 bg-card/80 p-6 sm:p-8 shadow-xl space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Terms of Service</h1>
          <p className="text-xs text-muted-foreground">Last updated: November 2026. Written in simple words on purpose.</p>
        </div>
        {sections.map((s) => (
          <section key={s.title} className="space-y-2">
            <h2 className="text-sm font-bold text-foreground">{s.title}</h2>
            <ul className="list-disc pl-5 space-y-1.5 text-sm text-muted-foreground leading-relaxed">
              {s.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
        ))}
        <div className="pt-2 flex gap-4 text-xs">
          <Link href="/privacy" className="text-primary font-semibold hover:underline">Privacy Policy</Link>
          <Link href="/signup" className="inline-flex items-center gap-1 text-primary font-semibold hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
