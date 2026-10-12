"use client";

import { CheckCheck } from "lucide-react";
import { NotificationList } from "@/components/app/shell";
import { Button, PageHeader, Panel } from "@/components/ui";
import { useMarkRead, useNotifications } from "@/lib/queries";

export default function NotificationsPage() {
  const q = useNotifications();
  const markRead = useMarkRead();
  const unread = (q.data ?? []).filter((n) => !n.read_at);
  return (
    <div className="space-y-8">
      <PageHeader
        title="Notifications"
        description="Application decisions, drawdowns, weekly settlements and anything that needs your attention."
        actions={
          unread.length > 0 && (
            <Button size="sm" icon={<CheckCheck className="size-4" />} busy={markRead.isPending} onClick={() => markRead.mutate(unread.map((n) => n.id))}>
              Mark all read
            </Button>
          )
        }
      />
      {q.data && q.data.length > 0 ? (
        <Panel className="p-2">
          <NotificationList query={q} />
        </Panel>
      ) : (
        <NotificationList query={q} />
      )}
    </div>
  );
}
