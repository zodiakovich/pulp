import { redirect } from 'next/navigation';

/** Entry point for signed-in work; main generator lives at `/`. */
export default function DashboardPage() {
  redirect('/');
}
