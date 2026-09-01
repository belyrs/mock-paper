import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChoiceCard, GenerateShell } from "@/components/GenerateShell";
import { useAppState } from "@/context/app-state";
import { EXAMS, type ClassLevel } from "@/lib/mock-generator";

export const Route = createFileRoute("/generate/class")({
  head: () => ({
    meta: [
      { title: "Select Class — MockPaper" },
      {
        name: "description",
        content: "Choose Class 11 or Class 12 to continue building your question paper.",
      },
      { property: "og:title", content: "Select Class — MockPaper" },
      { property: "og:description", content: "Pick your class and continue." },
    ],
  }),
  component: SelectClass,
});

function SelectClass() {
  const { classLevel, exam, setClassLevel } = useAppState();
  const navigate = useNavigate();

  const choose = (c: ClassLevel) => {
    setClassLevel(c);
    void navigate({ to: "/generate/mode" });
  };

  return (
    <GenerateShell
      step="Class"
      title="Select Class"
      subtitle={
        exam
          ? `${EXAMS[exam].label} (${EXAMS[exam].stream}) — both classes support the same options.`
          : "Both classes support the exact same generation options."
      }
      back={{ to: "/generate", label: "Select Examination" }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        {(["Class 11", "Class 12"] as ClassLevel[]).map((c) => (
          <ChoiceCard
            key={c}
            title={c}
            selected={classLevel === c}
            onClick={() => choose(c)}
          />
        ))}
      </div>
    </GenerateShell>
  );
}
