import Link from 'next/link'
import { Package, DollarSign, Tag, TrendingUp } from 'lucide-react'

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">VaultTrove</h1>
        <p className="text-muted-foreground mb-8">Professional TCG Singles Management System</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/intake" className="p-6 border rounded-lg hover:shadow-lg transition">
            <Package className="w-8 h-8 mb-2" />
            <h2 className="text-xl font-semibold mb-1">Intake</h2>
            <p className="text-sm text-muted-foreground">Add new cards to inventory</p>
          </Link>
          
          <Link href="/inventory" className="p-6 border rounded-lg hover:shadow-lg transition">
            <Tag className="w-8 h-8 mb-2" />
            <h2 className="text-xl font-semibold mb-1">Inventory</h2>
            <p className="text-sm text-muted-foreground">View and manage stock</p>
          </Link>
          
          <Link href="/labels/print" className="p-6 border rounded-lg hover:shadow-lg transition">
            <DollarSign className="w-8 h-8 mb-2" />
            <h2 className="text-xl font-semibold mb-1">Labels</h2>
            <p className="text-sm text-muted-foreground">Print price labels</p>
          </Link>
          
          <Link href="/sales" className="p-6 border rounded-lg hover:shadow-lg transition">
            <TrendingUp className="w-8 h-8 mb-2" />
            <h2 className="text-xl font-semibold mb-1">Sales</h2>
            <p className="text-sm text-muted-foreground">View sales history</p>
          </Link>
        </div>
      </div>
    </main>
  )
}
