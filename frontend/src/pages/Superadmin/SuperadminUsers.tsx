"use client";

import { useEffect, useState } from "react";
import { 
  Users, 
  Search, 
  Filter, 
  Mail, 
  Phone, 
  Building2, 
  Calendar,
  Activity,
  ArrowUpDown,
  MoreVertical,
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getAllUsers } from "@/services/superadminService";
import { Badge } from "@/components/ui/badge";

const cardClass =
  "rounded-xl border border-[hsl(35_15%_85%)] bg-[hsl(39_30%_97%)] p-6 shadow-sm dark:border-[hsl(30_8%_22%)] dark:bg-[hsl(30_8%_14%)]";
const mutedTextClass =
  "text-[hsl(30_8%_45%)] dark:text-[hsl(38_10%_55%)]";
const strongTextClass =
  "text-[hsl(30_10%_15%)] dark:text-[hsl(38_20%_90%)]";

export default function SuperadminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const data = await getAllUsers();
      setUsers(data);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getAllUsers();
        setUsers(data);
      } catch (error) {
        console.error("Failed to fetch users:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredUsers = users
    .filter(user => {
      const search = searchTerm.toLowerCase();
      const matchesSearch = 
        (user.name?.toLowerCase() || "").includes(search) ||
        (user.email?.toLowerCase() || "").includes(search) ||
        (user.orgName?.toLowerCase() || "").includes(search);
      
      const matchesRole = selectedRole === "all" || user.role === selectedRole;
      
      return matchesSearch && matchesRole;
    })
    .sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
    });

  return (
    <div className="space-y-6 p-4 md:p-8 max-w-[1600px] mx-auto">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-row justify-between items-center w-full md:w-auto">
          <div>
            <h1 className={cn("text-2xl font-bold tracking-tight", strongTextClass)}>User Management</h1>
            <p className={cn("text-sm mt-1", mutedTextClass)}>
              Monitor and manage all users across the platform
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex justify-center items-center">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg border border-[hsl(35_15%_85%)] bg-[hsl(39_30%_97%)] text-[hsl(30_8%_45%)] transition-all duration-300 hover:bg-[hsl(37_18%_91%)] hover:text-[hsl(24_95%_53%)] hover:border-[hsl(24_95%_53%/0.35)] active:scale-95 disabled:pointer-events-none disabled:opacity-50 dark:border-[hsl(30_8%_22%)] dark:bg-[hsl(30_8%_14%)] dark:text-[hsl(38_10%_55%)] dark:hover:bg-[hsl(30_6%_18%)] dark:hover:text-[hsl(24_95%_53%)] dark:hover:border-[hsl(24_95%_53%/0.35)]"
              )}
              title="Refresh Users"
            >
              <RefreshCw
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-500",
                  isRefreshing && "animate-spin text-[hsl(24_95%_53%)]"
                )}
              />
            </button>
          </div>
          <div className="relative group min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-[hsl(24_95%_53%)] transition-colors" />
            <input 
              type="text" 
              placeholder="Search users..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-xl border border-[hsl(35_15%_85%)] bg-white dark:bg-black/20 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(24_95%_53%/0.2)] w-full transition-all shadow-sm"
            />
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-[hsl(35_15%_85%)] bg-white dark:bg-black/20 p-1 shadow-sm">
             <div className="px-2 text-[10px] font-bold uppercase opacity-40">Role</div>
             <select 
               value={selectedRole}
               onChange={(e) => setSelectedRole(e.target.value)}
               className="bg-transparent text-sm font-medium outline-none pr-2 cursor-pointer"
             >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="contributor">Contributor</option>
                <option value="client">Client</option>
             </select>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-[hsl(35_15%_85%)] bg-white dark:bg-black/20 p-1 shadow-sm">
             <div className="px-2 text-[10px] font-bold uppercase opacity-40">Sort</div>
             <select 
               value={sortBy}
               onChange={(e) => setSortBy(e.target.value)}
               className="bg-transparent text-sm font-medium outline-none pr-2 cursor-pointer"
             >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
             </select>
          </div>
        </div>
      </div>

      <div className={cardClass}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[hsl(35_15%_85%)] dark:border-[hsl(30_8%_22%)]">
                <th className="pb-4 text-left px-4">
                   <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider opacity-60">
                     User Info <ArrowUpDown className="h-3 w-3" />
                   </div>
                </th>
                <th className="pb-4 text-left px-4">
                   <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider opacity-60">
                     Organization
                   </div>
                </th>
                <th className="pb-4 text-left px-4">
                   <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider opacity-60">
                     Role
                   </div>
                </th>
                <th className="pb-4 text-left px-4">
                   <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider opacity-60">
                     Phone
                   </div>
                </th>
                <th className="pb-4 text-right px-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(35_15%_85%/0.4)] dark:divide-[hsl(30_8%_22%/0.4)]">
              {loading || isRefreshing ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="py-8 px-4 h-16 bg-[hsl(37_18%_91%/0.3)] dark:bg-white/5 rounded-lg mb-2" />
                  </tr>
                ))
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="group hover:bg-[hsl(37_18%_91%/0.4)] dark:hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-[hsl(24_95%_53%/0.1)] flex items-center justify-center text-[hsl(24_95%_53%)] font-bold">
                          {user.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className={cn("font-bold truncate", strongTextClass)}>{user.name}</div>
                          <div className="flex items-center gap-2 text-[11px] opacity-60 truncate">
                            <Mail className="h-3 w-3" /> {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 opacity-40" />
                        <span className={cn("text-sm font-medium", strongTextClass)}>{user.orgName}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <Badge variant="outline" className={cn(
                        "capitalize text-[10px] font-bold px-2 py-0.5",
                        user.role === 'superadmin' ? "bg-red-500/10 text-red-600 border-red-500/20" :
                        user.role === 'admin' ? "bg-[hsl(24_95%_53%/0.1)] text-[hsl(24_95%_53%)] border-[hsl(24_95%_53%/0.2)]" :
                        "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                      )}>
                        {user.role}
                      </Badge>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-xs font-bold">
                          <Phone className="h-3 w-3 text-[hsl(24_95%_53%)]" />
                          {user.phone}
                        </div>
                        <div className="text-[10px] opacity-50 flex items-center gap-1">
                          <Calendar className="h-2.5 w-2.5" /> Joined {new Date(user.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </td>
                    {/* <td className="py-4 px-4 text-right">
                      <button className="p-2 hover:bg-[hsl(35_15%_85%)] dark:hover:bg-white/10 rounded-lg transition-colors">
                        <MoreVertical className="h-4 w-4 opacity-40" />
                      </button>
                    </td> */}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-20 text-center opacity-40">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-10" />
                    <p className="text-sm font-medium">No users found matching your search.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
