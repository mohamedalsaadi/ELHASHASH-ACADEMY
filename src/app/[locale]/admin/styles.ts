// The shared form styles now live in components/ui so student and teacher forms do not import the
// admin route group. Re-exported here so the many admin files keep their import.
export { field, label } from "@/components/ui/form";
