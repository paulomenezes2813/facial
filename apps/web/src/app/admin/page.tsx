import { redirect } from 'next/navigation';
import { getAdminToken } from '@/lib/session';

export default function AdminIndex() {
  if (getAdminToken()) {
    redirect('/admin/dashboard');
  }
  redirect('/admin/login');
}
