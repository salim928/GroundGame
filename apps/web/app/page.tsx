import { redirect } from "next/navigation";

// Landing page is the split login screen.
export default function Home() {
  redirect("/login");
}
