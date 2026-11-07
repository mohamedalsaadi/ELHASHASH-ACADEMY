import { StaffMessages } from "@/components/StaffMessages";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return <StaffMessages>{children}</StaffMessages>;
}
