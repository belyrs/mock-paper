import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChoiceCard, GenerateShell } from "@/components/GenerateShell";
import { Badge } from "@/components/ui/badge";
import { useAppState } from "@/context/app-state";
import { EXAMS, type ExamId } from "@/lib/mock-generator";

export const Route = createFileRoute("/generate/")({
  head: () => ({
    meta: [
      { title: "Select Examination — MockPaper" },
      { name: "description", content: "Choose between JEE (PCM) and NEET (PCB) question papers." },
      { property: "og:title", content: "Select Examination — MockPaper" },
      { property: "og:description", content: "Pick JEE or NEET and continue configuring." },
    ],
  }),
  component: SelectExam,
});

function SelectExam() {
  const { exam, setExam } = useAppState();
  const navigate = useNavigate();

  const choose = (id: ExamId) => {
    setExam(id);
    void navigate({ to: "/generate/class" });
  };

  return (
    <GenerateShell
      step="Exam"
      title="Select Examination"
      subtitle="Choose your target exam to begin."
      back={{ to: "/", label: "Home" }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        {(Object.values(EXAMS) as (typeof EXAMS)[ExamId][]).map((e) => (
          <ChoiceCard
            key={e.id}
            title={`${e.label} (${e.stream})`}
            selected={exam === e.id}
            onClick={() => choose(e.id)}
            meta={
              <div className="flex flex-wrap gap-1.5">
                {e.subjects.map((s) => (
                  <Badge key={s} variant="secondary">
                    {s}
                  </Badge>
                ))}
              </div>
            }
          />
        ))}
      </div>
    </GenerateShell>
  );
}
