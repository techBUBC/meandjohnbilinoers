import CalendarPanel from "@/components/CalendarPanel";
import CommandConsole from "@/components/CommandConsole";
import GmailPanel from "@/components/GmailPanel";
import GoogleStatus from "@/components/GoogleStatus";
import TasksPanel from "@/components/TasksPanel";

export default function HomePage() {
  return (
    <div className="space-y-5">
      <GoogleStatus />
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,0.6fr)_minmax(0,0.4fr)]">
        <div className="flex flex-col gap-5">
          <CommandConsole whisperEnabled={process.env.WHISPER_ENABLED === "true"} />
          <TasksPanel />
        </div>
        <div className="flex flex-col gap-5">
          <GmailPanel />
          <CalendarPanel />
        </div>
      </section>
    </div>
  );
}
