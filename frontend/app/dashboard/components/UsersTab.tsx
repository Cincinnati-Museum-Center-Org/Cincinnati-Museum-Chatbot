'use client';

import { ChevronLeft, ChevronRight, Loader2, Users, Mail, Phone, HelpCircle } from 'lucide-react';
import { User } from '../types';

interface UsersTabProps {
  users: User[];
  isLoading: boolean;
  currentPage: number;
  totalUsers: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function UsersTab({
  users,
  isLoading,
  currentPage,
  totalUsers,
  pageSize,
  onPageChange,
}: UsersTabProps) {
  const totalPages = Math.ceil(totalUsers / pageSize);
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalUsers);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-[#4B7BF5]" />
          <h3 className="font-medium text-slate-800">User Directory</h3>
        </div>
        <span className="text-sm text-slate-500">
          {totalUsers > 0 ? `Showing ${startIndex}-${endIndex} of ${totalUsers} users` : 'No users found'}
        </span>
      </div>

      {/* Users List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">
                  Name
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-4 h-4" />
                    Email
                  </div>
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-4 h-4" />
                    Phone
                  </div>
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4" />
                    Support Question
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#4B7BF5]/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-[#4B7BF5]">
                          {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {user.firstName} {user.lastName}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <a 
                      href={`mailto:${user.email}`}
                      className="text-sm text-[#4B7BF5] hover:underline"
                    >
                      {user.email}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {user.phoneNumber ? (
                      <a 
                        href={`tel:${user.phoneNumber}`}
                        className="hover:text-[#4B7BF5] transition-colors"
                      >
                        {user.phoneNumber}
                      </a>
                    ) : (
                      <span className="text-slate-400 italic">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-slate-700 line-clamp-2 max-w-md">
                      {user.supportQuestion}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && !isLoading && (
          <div className="p-8 text-center text-slate-500">
            <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No users found</p>
          </div>
        )}

        {isLoading && (
          <div className="p-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#4B7BF5] mx-auto" />
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-3">
          <p className="text-sm text-slate-600">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1 || isLoading}
              className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            
            {/* Page numbers */}
            <div className="hidden sm:flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => onPageChange(pageNum)}
                    disabled={isLoading}
                    className={`w-8 h-8 rounded-lg text-sm transition-colors ${
                      currentPage === pageNum
                        ? 'bg-[#4B7BF5] text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages || isLoading}
              className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

