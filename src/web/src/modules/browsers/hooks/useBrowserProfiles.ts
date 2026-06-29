import { Modal, message } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { client } from "src/lib/client";
import type { BrowserProfileItem } from "src/lib/resources/browser";

export function useBrowserProfiles() {
  const [profiles, setProfiles] = useState<BrowserProfileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<BrowserProfileItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Per-profile open tabs cache
  const [profileTabs, setProfileTabs] = useState<Record<string, Array<{ index: number; url: string; title: string }>>>({});

  // Debounce search input (400ms)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  // Fetch list
  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.browserProfiles.list({ page, limit, search: debouncedSearch });
      setProfiles(res.items);
      setTotal(res.meta.total);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load browser profiles";
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  // Fetch tabs for running profiles
  const fetchTabsForProfile = useCallback(async (id: string) => {
    try {
      const tabs = await client.browserProfiles.getTabs(id);
      setProfileTabs((prev) => ({ ...prev, [id]: tabs }));
    } catch {
      // silently ignore
    }
  }, []);

  // Poll running profiles for status + tabs
  useEffect(() => {
    const runningProfiles = profiles.filter((p) => p.status === "running");
    if (runningProfiles.length === 0) return;

    // Fetch tabs immediately for running profiles
    runningProfiles.forEach((p) => fetchTabsForProfile(p.id));

    const interval = setInterval(async () => {
      try {
        const res = await client.browserProfiles.list({ page, limit, search: debouncedSearch });
        const changed = res.items.some((p, i) => {
          const old = profiles[i];
          return !old || old.status !== p.status || old.tabCount !== p.tabCount;
        });
        if (changed) {
          setProfiles(res.items);
          setTotal(res.meta.total);
        }

        // Refresh tabs for running profiles
        res.items.filter((p) => p.status === "running").forEach((p) => fetchTabsForProfile(p.id));
      } catch {
        // ignore poll errors
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [profiles, page, limit, debouncedSearch, fetchTabsForProfile]);

  // Delete profile
  const handleDelete = (id: string, name: string) => {
    Modal.confirm({
      title: "Delete Browser Profile?",
      content: `Permanently delete "${name}" and erase its cached session data from disk.`,
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: async () => {
        try {
          await client.browserProfiles.delete(id);
          message.success("Profile deleted");
          fetchProfiles();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to delete profile";
          message.error(msg);
        }
      },
    });
  };

  // Submit Modal Create/Update
  const handleSubmit = async (values: {
    name: string;
    description?: string;
    proxyConfig?: Record<string, unknown>;
    fingerprintConfig?: Record<string, unknown>;
  }) => {
    setActionLoading(true);
    try {
      if (editingProfile) {
        await client.browserProfiles.update(editingProfile.id, values);
        message.success("Profile updated");
      } else {
        await client.browserProfiles.create(values);
        message.success("Profile created");
      }
      setModalOpen(false);
      setEditingProfile(null);
      fetchProfiles();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save profile";
      message.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  return {
    profiles,
    loading,
    total,
    page,
    limit,
    search,
    modalOpen,
    editingProfile,
    actionLoading,
    profileTabs,
    setPage,
    setLimit,
    setSearch,
    setModalOpen,
    setEditingProfile,
    handleDelete,
    handleSubmit,
    fetchProfiles,
  };
}
