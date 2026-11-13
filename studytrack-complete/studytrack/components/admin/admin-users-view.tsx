import { useEffect, useState } from 'react'
import { Loader2, ShieldCheck, UserCog } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/app/shared'

export function AdminUsersView() {
  const [users, setUsers] = useState<Array<{ id: string; email: string; full_name: string | null; is_admin: boolean }>>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)

  async function loadUsers() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(body?.error ?? 'Could not load users.')
        return
      }
      setUsers(body.users ?? [])
    } catch {
      toast.error('Could not load users.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadUsers()
  }, [])

  async function toggleAdmin(userId: string, nextAdmin: boolean) {
    setSavingId(userId)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, is_admin: nextAdmin }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(body?.error ?? 'Could not update the user.')
        return
      }
      setUsers((current) => current.map((item) => (item.id === userId ? { ...item, is_admin: nextAdmin } : item)))
      toast.success(nextAdmin ? 'User promoted to admin.' : 'Admin access removed.')
    } catch {
      toast.error('Could not update the user.')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <>
      <PageHeader
        title="User management"
        description="Review registered students and grant or revoke admin access."
      />

      <div className="rounded-2xl border bg-card">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading users...
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-sm text-muted-foreground">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3">{user.full_name ?? '—'}</td>
                    <td className="px-4 py-3">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-medium text-foreground">
                        {user.is_admin ? <ShieldCheck className="size-3.5" aria-hidden="true" /> : <UserCog className="size-3.5" aria-hidden="true" />}
                        {user.is_admin ? 'Admin' : 'Student'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant={user.is_admin ? 'outline' : 'default'}
                        size="sm"
                        onClick={() => toggleAdmin(user.id, !user.is_admin)}
                        disabled={savingId === user.id}
                      >
                        {savingId === user.id ? (
                          <>
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                            Saving...
                          </>
                        ) : user.is_admin ? 'Remove admin' : 'Make admin'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
