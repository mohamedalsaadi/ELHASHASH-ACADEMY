import { StaffMessages } from "@/components/StaffMessages";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <StaffMessages>{children}</StaffMessages>;
}
