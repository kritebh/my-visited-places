import { AppNav } from "@/components/AppNav";
import { YearProvider } from "@/components/YearContext";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <YearProvider>
      <AppNav />
      <div className="flex-1 flex flex-col md:pl-56 pb-[calc(60px+env(safe-area-inset-bottom))] md:pb-0">{children}</div>
    </YearProvider>
  );
}
