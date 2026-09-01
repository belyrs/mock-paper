import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChoiceCard, GenerateShell } from "@/components/GenerateShell";
import { useAppState } from "@/context/app-state";
import { EXAMS, type Mode } from "@/lib/mock-generator";

export const Route = createFileRoute("/generate/mode")({
  head: () => ({
    meta: [
      { title: "Generation Mode — MockPaper" },
      {
        name: "description",
        content: "Choose between generating a Full Paper or an Individual Question set.",
      },
      { property: "og:title", content: "Generation Mode — MockPaper" },
      { property: "og:description", content: "Full Paper or Individual Question — your choice." },
    ],
  }),
  component: SelectMode,
});

function SelectMode() {
  const { exam, classLevel, mode, setMode } = useAppState();
  const navigate = useNavigate();

  const choose = (m: Mode) => {
    setMode(m);
    void navigate({ to: "/generate/configure" });
  };

  const subjects = exam ? EXAMS[exam].subjects.join(", ") : "";

  return (
    <GenerateShell
      step="Mode"
      title="What do you want to generate?"
      subtitle={
        classLevel && exam
          ? `${classLevel} — ${EXAMS[exam].label} (${EXAMS[exam].stream})`
          : undefined
      }
      back={{ to: "/generate/class", label: "Select Class" }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <ChoiceCard
          title="Full Paper"
          description={`Generate a complete paper based on the configuration selected for each subject${subjects ? ` (${subjects}).` : "."}`}
          selected={mode === "full-paper"}
          onClick={() => choose("full-paper")}
        />
        <ChoiceCard
          title="Individual Question"
          description="Generate a set of individual questions based on a selected subject, chapter, sub-topic, difficulty, and number of questions."
          selected={mode === "individual"}
          onClick={() => choose("individual")}
        />
      </div>
    </GenerateShell>
  );
}
