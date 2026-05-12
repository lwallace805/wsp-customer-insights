import Link from 'next/link';
import { BarChart2, MessageSquare, Lightbulb, Home, TrendingUp } from 'lucide-react';

const links = [
  { href: '/',            label: 'Overview',    icon: Home },
  { href: '/enrollment',  label: 'Enrollment',  icon: TrendingUp },
  { href: '/nps',         label: 'NPS',         icon: BarChart2 },
  { href: '/surveys',     label: 'Surveys',     icon: MessageSquare },
  { href: '/insights',    label: 'Insights',    icon: Lightbulb },
];

export default function NavBar() {
  return (
    <nav className="bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-900 text-base">WSP Customer Insights</span>
        </div>
        <div className="flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
            >
              <Icon size={14} />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
