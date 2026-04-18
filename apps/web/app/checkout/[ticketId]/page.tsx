import { CheckoutForm } from './checkout-form';

interface PageProps {
  params: Promise<{ ticketId: string }>;
}

export default async function CheckoutPage({ params }: PageProps) {
  const { ticketId } = await params;
  return <CheckoutForm ticketId={ticketId} />;
}
