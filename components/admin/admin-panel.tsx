"use client";

import { LoaderCircle, Plus, RefreshCw, ShieldAlert, UsersRound } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  createAdminTeam,
  createAdminUser,
  setAdminMembership,
  setAdminMembershipActive,
  setAdminUserPassword,
  transferAdminMembership,
  updateAdminTeam,
  updateAdminUser,
} from "@/lib/admin/admin-functions";
import { isAdminEmail } from "@/lib/admin/access";
import type { AdminMembership, AdminTeam, AdminUser } from "@/lib/admin/types";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/auth/use-auth";
import { useAdminDirectory } from "@/hooks/admin/use-admin-directory";
import type { TeamRole } from "@/types/membership";

type AdminTab = "teams" | "users";

const inputClassName =
  "h-9 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

function isConfirmed(message: string): boolean {
  return window.confirm(message);
}

function TeamForm({ onSaved }: { onSaved: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!name.trim()) {
      toast.error("اسم الفريق مطلوب");
      return;
    }

    setIsSaving(true);
    try {
      await createAdminTeam({ name, description });
      await onSaved();
      setName("");
      setDescription("");
      toast.success("تم إنشاء الفريق");
    } catch {
      toast.error("تعذر إنشاء الفريق");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="grid gap-2 rounded-2xl border border-border/70 bg-card p-4 sm:grid-cols-[1fr_1fr_auto]" onSubmit={submit}>
      <label className="sr-only" htmlFor="admin-team-name">اسم الفريق</label>
      <input id="admin-team-name" className={inputClassName} placeholder="اسم الفريق" value={name} onChange={(event) => setName(event.target.value)} />
      <label className="sr-only" htmlFor="admin-team-description">الوصف</label>
      <input id="admin-team-description" className={inputClassName} placeholder="الوصف - اختياري" value={description} onChange={(event) => setDescription(event.target.value)} />
      <Button type="submit" size="sm" disabled={isSaving} aria-busy={isSaving}>
        {isSaving ? <LoaderCircle className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
        إنشاء فريق
      </Button>
    </form>
  );
}

function TeamRow({ team, onSaved }: { team: AdminTeam; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description);
  const [isSaving, setIsSaving] = useState(false);

  async function save(): Promise<void> {
    if (!name.trim()) {
      toast.error("اسم الفريق مطلوب");
      return;
    }

    setIsSaving(true);
    try {
      await updateAdminTeam({ teamId: team.id, name, description });
      await onSaved();
      toast.success("تم تحديث الفريق");
    } catch {
      toast.error("تعذر تحديث الفريق");
    } finally {
      setIsSaving(false);
    }
  }

  async function setActive(active: boolean): Promise<void> {
    const action = active ? "إعادة تفعيل" : "أرشفة";
    if (!isConfirmed(`${action} فريق ${team.name}؟`)) return;

    setIsSaving(true);
    try {
      await updateAdminTeam({ teamId: team.id, active });
      await onSaved();
      toast.success(active ? "تمت إعادة تفعيل الفريق" : "تمت أرشفة الفريق");
    } catch {
      toast.error("تعذر تحديث حالة الفريق");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <article className="grid gap-2 rounded-2xl border border-border/70 bg-card p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
      <div className="min-w-0 space-y-2">
        <input className={inputClassName} value={name} aria-label={`اسم ${team.name}`} onChange={(event) => setName(event.target.value)} disabled={isSaving} />
        <p className={`text-xs ${team.active ? "text-muted-foreground" : "text-amber-600 dark:text-amber-400"}`}>
          {team.active ? "نشط" : "مؤرشف"}
        </p>
      </div>
      <input className={inputClassName} value={description} aria-label={`وصف ${team.name}`} onChange={(event) => setDescription(event.target.value)} disabled={isSaving} />
      <div className="flex flex-wrap gap-2 sm:justify-end">
        <Button type="button" variant="outline" size="sm" onClick={() => void save()} disabled={isSaving}>حفظ</Button>
        <Button type="button" variant={team.active ? "destructive" : "outline"} size="sm" onClick={() => void setActive(!team.active)} disabled={isSaving}>
          {team.active ? "أرشفة" : "إعادة تفعيل"}
        </Button>
      </div>
    </article>
  );
}

function TeamsTab({ teams, onSaved }: { teams: AdminTeam[]; onSaved: () => Promise<void> }) {
  return (
    <section className="space-y-4">
      <TeamForm onSaved={onSaved} />
      {teams.length === 0 ? <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">لا توجد فرق بعد</p> : teams.map((team) => <TeamRow key={team.id} team={team} onSaved={onSaved} />)}
    </section>
  );
}

function UserCreationForm({ onSaved }: { onSaved: () => Promise<void> }) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!displayName.trim() || !email.trim() || !password) {
      toast.error("أكمل بيانات المستخدم");
      return;
    }
    if (password !== confirmation) {
      toast.error("كلمتا المرور غير متطابقتين");
      return;
    }

    setIsSaving(true);
    try {
      await createAdminUser({ displayName, email, password });
      await onSaved();
      setDisplayName("");
      setEmail("");
      setPassword("");
      setConfirmation("");
      toast.success("تم إنشاء المستخدم");
    } catch {
      toast.error("تعذر إنشاء المستخدم");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="grid gap-2 rounded-2xl border border-border/70 bg-card p-4 sm:grid-cols-2" onSubmit={submit}>
      <input className={inputClassName} placeholder="الاسم الظاهر" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
      <input className={inputClassName} type="email" dir="ltr" placeholder="البريد الإلكتروني" value={email} onChange={(event) => setEmail(event.target.value)} />
      <input className={inputClassName} type="password" placeholder="كلمة المرور المؤقتة" value={password} onChange={(event) => setPassword(event.target.value)} />
      <input className={inputClassName} type="password" placeholder="تأكيد كلمة المرور" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
      <div className="sm:col-span-2">
        <Button type="submit" size="sm" disabled={isSaving} aria-busy={isSaving}>{isSaving ? <LoaderCircle className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} إنشاء مستخدم</Button>
      </div>
    </form>
  );
}

function MembershipForm({
  userId,
  teams,
  onSaved,
}: {
  userId: string;
  teams: AdminTeam[];
  onSaved: () => Promise<void>;
}) {
  const activeTeams = teams.filter((team) => team.active);
  const [teamId, setTeamId] = useState(activeTeams[0]?.id ?? "");
  const [role, setRole] = useState<TeamRole>("MEMBER");
  const [isSaving, setIsSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!teamId) return;
    setIsSaving(true);
    try {
      await setAdminMembership({ teamId, userId, role });
      await onSaved();
      toast.success("تمت إضافة المستخدم إلى الفريق");
    } catch {
      toast.error("تعذر إضافة المستخدم إلى الفريق");
    } finally {
      setIsSaving(false);
    }
  }

  if (activeTeams.length === 0) return null;

  return (
    <form className="mt-3 grid gap-2 rounded-xl bg-muted/50 p-3 sm:grid-cols-[1fr_auto_auto]" onSubmit={submit}>
      <select className={inputClassName} value={teamId} onChange={(event) => setTeamId(event.target.value)} aria-label="الفريق">
        {activeTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
      </select>
      <select className={inputClassName} value={role} onChange={(event) => setRole(event.target.value as TeamRole)} aria-label="الدور">
        <option value="MEMBER">عضو</option>
        <option value="LEADER">قائد</option>
      </select>
      <Button type="submit" variant="outline" size="sm" disabled={isSaving}>إضافة إلى فريق</Button>
    </form>
  );
}

function TransferDialog({
  user,
  teams,
  memberships,
  onClose,
  onSaved,
}: {
  user: AdminUser;
  teams: AdminTeam[];
  memberships: AdminMembership[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const activeMemberships = memberships.filter((membership) => membership.active);
  const [sourceTeamId, setSourceTeamId] = useState(activeMemberships[0]?.teamId ?? "");
  const [destinationTeamId, setDestinationTeamId] = useState("");
  const [role, setRole] = useState<TeamRole>("MEMBER");
  const [moveWorkspace, setMoveWorkspace] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const destinationTeams = teams.filter((team) => team.active && team.id !== sourceTeamId);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!sourceTeamId || !destinationTeamId) {
      toast.error("اختر الفريق المصدر والفريق الجديد");
      return;
    }
    if (!isConfirmed(`نقل ${user.displayName} إلى الفريق الجديد؟`)) return;

    setIsSaving(true);
    try {
      await transferAdminMembership({
        userId: user.uid,
        sourceTeamId,
        destinationTeamId,
        role,
        moveWorkspace,
      });
      await onSaved();
      toast.success("تم نقل المستخدم إلى الفريق الجديد");
      onClose();
    } catch {
      toast.error("تعذر نقل المستخدم إلى الفريق الجديد");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="إغلاق نقل المستخدم" onClick={onClose} disabled={isSaving} />
      <section role="dialog" aria-modal="true" aria-labelledby="transfer-user-title" className="relative z-10 w-full max-w-md rounded-2xl border border-border/70 bg-card p-5 shadow-2xl">
        <h2 id="transfer-user-title" className="text-base font-bold text-foreground">نقل {user.displayName} إلى فريق آخر</h2>
        <form className="mt-4 space-y-3" onSubmit={submit}>
          <select className={inputClassName} value={sourceTeamId} onChange={(event) => { setSourceTeamId(event.target.value); setDestinationTeamId(""); }} aria-label="الفريق المصدر">
            {activeMemberships.map((membership) => <option key={membership.id} value={membership.teamId}>{teams.find((team) => team.id === membership.teamId)?.name ?? membership.teamId}</option>)}
          </select>
          <select className={inputClassName} value={destinationTeamId} onChange={(event) => setDestinationTeamId(event.target.value)} aria-label="الفريق الجديد">
            <option value="">اختر الفريق الجديد</option>
            {destinationTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
          <select className={inputClassName} value={role} onChange={(event) => setRole(event.target.value as TeamRole)} aria-label="الدور الجديد">
            <option value="MEMBER">عضو</option>
            <option value="LEADER">قائد</option>
          </select>
          <label className="flex items-start gap-2 text-sm text-foreground"><input type="checkbox" className="mt-1 size-4 accent-primary" checked={moveWorkspace} onChange={(event) => setMoveWorkspace(event.target.checked)} />نقل مساحة العمل والمهام إلى الفريق الجديد</label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSaving}>إلغاء</Button>
            <Button type="submit" size="sm" disabled={isSaving}>{isSaving ? <LoaderCircle className="size-3.5 animate-spin" /> : null}نقل</Button>
          </div>
        </form>
      </section>
    </div>
  );
}

function UserRow({ user, teams, memberships, onSaved }: { user: AdminUser; teams: AdminTeam[]; memberships: AdminMembership[]; onSaved: () => Promise<void> }) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);

  async function saveName(): Promise<void> {
    if (!displayName.trim()) return;
    setIsSaving(true);
    try {
      await updateAdminUser({ uid: user.uid, displayName });
      await onSaved();
      toast.success("تم تحديث اسم المستخدم");
    } catch { toast.error("تعذر تحديث اسم المستخدم"); } finally { setIsSaving(false); }
  }

  async function setUserActive(active: boolean): Promise<void> {
    if (!isConfirmed(`${active ? "إعادة تفعيل" : "تعطيل"} المستخدم ${user.displayName}؟`)) return;
    setIsSaving(true);
    try {
      await updateAdminUser({ uid: user.uid, active });
      await onSaved();
      toast.success(active ? "تمت إعادة تفعيل المستخدم" : "تم تعطيل المستخدم");
    } catch { toast.error("تعذر تحديث حالة المستخدم"); } finally { setIsSaving(false); }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!password || password !== confirmation) { toast.error("كلمتا المرور غير متطابقتين"); return; }
    if (!isConfirmed(`تعيين كلمة مرور جديدة لـ ${user.displayName}؟`)) return;
    setIsSaving(true);
    try {
      await setAdminUserPassword({ uid: user.uid, password });
      setPassword(""); setConfirmation("");
      toast.success("تم تعيين كلمة المرور الجديدة");
    } catch { toast.error("تعذر تعيين كلمة المرور الجديدة"); } finally { setIsSaving(false); }
  }

  async function changeRole(membership: AdminMembership, role: TeamRole): Promise<void> {
    if (!isConfirmed("تغيير دور المستخدم في الفريق؟")) return;
    setIsSaving(true);
    try {
      await setAdminMembership({ teamId: membership.teamId, userId: user.uid, role });
      await onSaved();
      toast.success("تم تغيير دور المستخدم");
    } catch { toast.error("تعذر تغيير الدور"); } finally { setIsSaving(false); }
  }

  async function changeMembershipActive(membership: AdminMembership, active: boolean): Promise<void> {
    if (!isConfirmed(`${active ? "إعادة إضافة" : "إزالة"} المستخدم من الفريق؟`)) return;
    setIsSaving(true);
    try {
      await setAdminMembershipActive({ teamId: membership.teamId, userId: user.uid, active });
      await onSaved();
      toast.success(active ? "تمت إعادة إضافة المستخدم" : "تمت إزالة المستخدم من الفريق");
    } catch { toast.error("تعذر تحديث العضوية"); } finally { setIsSaving(false); }
  }

  return (
    <article className="rounded-2xl border border-border/70 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0"><p className="font-bold text-foreground">{user.displayName}</p><p dir="ltr" className="truncate text-xs text-muted-foreground">{user.email}</p></div>
        <div className="flex gap-2"><Button type="button" variant={user.active ? "destructive" : "outline"} size="sm" onClick={() => void setUserActive(!user.active)} disabled={isSaving}>{user.active ? "تعطيل" : "إعادة تفعيل"}</Button><Button type="button" variant="outline" size="sm" onClick={() => setIsTransferring(true)} disabled={isSaving || memberships.filter((membership) => membership.active).length === 0}>نقل إلى فريق آخر</Button></div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]"><input className={inputClassName} value={displayName} aria-label="الاسم الظاهر" onChange={(event) => setDisplayName(event.target.value)} disabled={isSaving} /><Button type="button" variant="outline" size="sm" onClick={() => void saveName()} disabled={isSaving}>حفظ الاسم</Button></div>

      <form className="mt-3 grid gap-2 rounded-xl bg-muted/50 p-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={resetPassword}><input className={inputClassName} type="password" placeholder="كلمة مرور جديدة" value={password} onChange={(event) => setPassword(event.target.value)} /><input className={inputClassName} type="password" placeholder="تأكيد كلمة المرور" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /><Button type="submit" variant="outline" size="sm" disabled={isSaving}>تعيين كلمة مرور جديدة</Button></form>

      <div className="mt-3 space-y-2">
        <p className="text-sm font-semibold text-foreground">عضويات الفرق</p>
        {memberships.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد عضويات حالية</p> : memberships.map((membership) => {
          const team = teams.find((item) => item.id === membership.teamId);
          return <div key={membership.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm"><span className="min-w-32 flex-1 font-medium text-foreground">{team?.name ?? membership.teamId}</span><select className="h-8 rounded-lg border border-input bg-background px-2 text-xs" value={membership.role} disabled={!membership.active || isSaving} onChange={(event) => void changeRole(membership, event.target.value as TeamRole)}><option value="MEMBER">عضو</option><option value="LEADER">قائد</option></select><Button type="button" variant={membership.active ? "destructive" : "outline"} size="xs" disabled={isSaving} onClick={() => void changeMembershipActive(membership, !membership.active)}>{membership.active ? "إزالة" : "إعادة تفعيل"}</Button></div>;
        })}
      </div>
      <MembershipForm userId={user.uid} teams={teams} onSaved={onSaved} />
      {isTransferring ? <TransferDialog user={user} teams={teams} memberships={memberships} onClose={() => setIsTransferring(false)} onSaved={onSaved} /> : null}
    </article>
  );
}

function UsersTab({ users, teams, memberships, onSaved }: { users: AdminUser[]; teams: AdminTeam[]; memberships: AdminMembership[]; onSaved: () => Promise<void> }) {
  const membershipsByUser = useMemo(() => {
    const result = new Map<string, AdminMembership[]>();
    memberships.forEach((membership) => result.set(membership.userId, [...(result.get(membership.userId) ?? []), membership]));
    return result;
  }, [memberships]);

  return <section className="space-y-4"><UserCreationForm onSaved={onSaved} />{users.length === 0 ? <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">لا يوجد مستخدمون بعد</p> : users.map((user) => <UserRow key={user.uid} user={user} teams={teams} memberships={membershipsByUser.get(user.uid) ?? []} onSaved={onSaved} />)}</section>;
}

export function AdminPanel() {
  const { firebaseUser } = useAuth();
  const isAdmin = isAdminEmail(firebaseUser?.email);
  const { teams, users, memberships, isLoading, error, refresh } = useAdminDirectory(isAdmin);
  const [tab, setTab] = useState<AdminTab>("teams");

  if (!isAdmin) {
    return <main className="flex min-h-full items-center justify-center p-6"><section className="max-w-md rounded-2xl border border-border/70 bg-card p-6 text-center"><ShieldAlert className="mx-auto size-7 text-muted-foreground" /><h1 className="mt-3 font-bold text-foreground">لا تملك صلاحية الإدارة</h1></section></main>;
  }

  if (isLoading) {
    return <main className="flex min-h-full items-center justify-center p-6"><div className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />جارٍ تحميل بيانات الإدارة</div></main>;
  }

  if (error) {
    return <main className="flex min-h-full items-center justify-center p-6"><section className="rounded-2xl border border-border/70 bg-card p-6 text-center"><p className="text-sm font-semibold text-foreground">تعذر تحميل بيانات الإدارة</p><Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void refresh()}><RefreshCw className="size-3.5" />إعادة المحاولة</Button></section></main>;
  }

  return (
    <main className="min-h-full bg-background px-4 py-6 sm:px-6 lg:px-8">
      <section className="mx-auto w-full max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-5"><div><div className="flex items-center gap-2 text-primary"><UsersRound className="size-5" /><h1 className="text-xl font-bold text-foreground">إدارة الفرق والمستخدمين</h1></div><p className="mt-1 text-sm text-muted-foreground">إدارة الفرق، الحسابات، وعضويات العمل.</p></div><Button type="button" variant="outline" size="sm" onClick={() => void refresh()}><RefreshCw className="size-3.5" />تحديث</Button></header>
        <div className="mt-5 flex rounded-2xl bg-muted/70 p-1"><button type="button" className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${tab === "teams" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`} onClick={() => setTab("teams")}>الفرق</button><button type="button" className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${tab === "users" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`} onClick={() => setTab("users")}>المستخدمون</button></div>
        <div className="mt-5">{tab === "teams" ? <TeamsTab teams={teams} onSaved={refresh} /> : <UsersTab users={users} teams={teams} memberships={memberships} onSaved={refresh} />}</div>
      </section>
    </main>
  );
}
