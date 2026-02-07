// Force dynamic rendering to skip static generation
export const dynamic = 'force-dynamic';

import NotFoundClient from './NotFoundClient';

export default function NotFound() {
  return <NotFoundClient />;
}
