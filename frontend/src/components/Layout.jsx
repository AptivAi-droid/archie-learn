import { Outlet } from 'react-router-dom'
import BottomNav from './BottomNav'

export default function Layout() {
  return (
    <div className="max-w-lg mx-auto relative min-h-screen">
      <Outlet />
      <BottomNav />
    </div>
  )
}
