import React from "react";
import { CalendarClock, Clock3, FileText, ShieldAlert } from "lucide-react";

export default function ExamSettingsPanel({
  settings,
  onChange,
  instructorCourses = [],
  computedTotalPoints = 0,
}) {
  const toggle = (field) => onChange(field, !Boolean(settings[field]));
  const sectionTitle = "mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-emerald-800";
  const labelClass = "text-sm font-medium text-gray-700";
  const helperClass = "mt-1 text-xs text-gray-500";
  const inputClass = "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";

  return (
    <div className="space-y-6 rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
      <section className="space-y-3">
        <h3 className={sectionTitle}>
          <FileText className="h-4 w-4" /> General Info
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <label className={labelClass}>
            Exam Title
            <input
              value={settings.title}
              onChange={(event) => onChange("title", event.target.value)}
              placeholder="Midterm Examination - Biology 101"
              className={inputClass}
            />
            <p className={helperClass}>Visible to students on exam card and attempt page.</p>
          </label>
          <label className={labelClass}>
            Assessment Type
            <select
              value={settings.assessment_type}
              onChange={(event) => onChange("assessment_type", event.target.value)}
              className={inputClass}
            >
              <option value="quiz">Quiz</option>
              <option value="exam">Exam</option>
            </select>
            <p className={helperClass}>Use Exam for high-stakes assessments.</p>
          </label>
          <label className={`md:col-span-2 ${labelClass}`}>
            Instructions for students
            <textarea
              rows={3}
              value={settings.description}
              onChange={(event) => onChange("description", event.target.value)}
              placeholder="Read each question carefully before submitting."
              className={inputClass}
            />
          </label>
          <label className={`md:col-span-2 ${labelClass}`}>
            Pre-Exam Acknowledgment Message
            <textarea
              rows={2}
              value={settings.pre_exam_message || ""}
              onChange={(event) => onChange("pre_exam_message", event.target.value)}
              placeholder="By starting this assessment, you agree to the exam and anti-cheat rules."
              className={inputClass}
            />
            <p className={helperClass}>Shown in student consent modal before an attempt starts.</p>
          </label>
          <label className={labelClass}>
            Publish Status
            <select
              value={settings.publish_state}
              onChange={(event) => onChange("publish_state", event.target.value)}
              className={inputClass}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </label>
          <label className={labelClass}>
            Topic Tag (Optional)
            <input
              value={settings.topic || ""}
              onChange={(event) => onChange("topic", event.target.value)}
              placeholder="Cell Biology"
              className={inputClass}
            />
          </label>
        </div>
      </section>

      <section className="space-y-3 border-t border-emerald-100 pt-4">
        <h3 className={sectionTitle}>
          <CalendarClock className="h-4 w-4" /> Scheduling
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          <label className={labelClass}>
            Submission Deadline
            <input
              type="datetime-local"
              value={settings.due_date || ""}
              onChange={(event) => onChange("due_date", event.target.value)}
              className={inputClass}
              placeholder="YYYY-MM-DD HH:MM"
            />
            <p className={helperClass}>Final deadline for submissions.</p>
          </label>
          <label className={labelClass}>
            Exam Availability Start
            <input
              type="datetime-local"
              value={settings.availability_start || ""}
              onChange={(event) => onChange("availability_start", event.target.value)}
              className={inputClass}
              placeholder="YYYY-MM-DD HH:MM"
            />
          </label>
          <label className={labelClass}>
            Exam Lock Time
            <input
              type="datetime-local"
              value={settings.availability_end || ""}
              onChange={(event) => onChange("availability_end", event.target.value)}
              className={inputClass}
              placeholder="YYYY-MM-DD HH:MM"
            />
          </label>
        </div>
      </section>

      <section className="space-y-3 border-t border-emerald-100 pt-4">
        <h3 className={sectionTitle}>
          <Clock3 className="h-4 w-4" /> Settings
        </h3>
        <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Total points (auto): <span className="font-semibold">{Number(computedTotalPoints || 0)}</span>
          <p className={helperClass}>Computed from the sum of all question points.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <label className={labelClass}>
            Duration (minutes)
            <input
              type="number"
              min={1}
              value={Math.round(Number(settings.quiz_time_limit_seconds || 0) / 60)}
              onChange={(event) =>
                onChange("quiz_time_limit_seconds", Math.max(60, Number(event.target.value || 1) * 60))
              }
              className={inputClass}
              placeholder="60"
            />
          </label>
          <label className={labelClass}>
            Max Attempts
            <input
              type="number"
              min={1}
              value={settings.max_attempts}
              onChange={(event) => onChange("max_attempts", Number(event.target.value || 1))}
              className={inputClass}
              placeholder="1"
            />
          </label>
          <label className={labelClass}>
            Random Question Subset (0 = all)
            <input
              type="number"
              min={0}
              value={settings.random_subset_size || 0}
              onChange={(event) => onChange("random_subset_size", Number(event.target.value || 0))}
              className={inputClass}
              placeholder="10"
            />
          </label>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <input type="checkbox" checked={Boolean(settings.randomize_questions)} onChange={() => toggle("randomize_questions")} />
            Shuffle Questions
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <input type="checkbox" checked={Boolean(settings.randomize_choices)} onChange={() => toggle("randomize_choices")} />
            Shuffle Answer Choices
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <input type="checkbox" checked={Boolean(settings.require_answer_to_advance)} onChange={() => toggle("require_answer_to_advance")} />
            Require Answer Before Next
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <input type="checkbox" checked={Boolean(settings.anti_cheat_enabled)} onChange={() => toggle("anti_cheat_enabled")} />
            Enable Anti-Cheat Controls
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <input type="checkbox" checked={Boolean(settings.show_score_immediately)} onChange={() => toggle("show_score_immediately")} />
            Show Score Immediately
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <input type="checkbox" checked={Boolean(settings.allow_answer_review)} onChange={() => toggle("allow_answer_review")} />
            Allow Answer Review
          </label>
        </div>
      </section>

      <section className="space-y-3 border-t border-emerald-100 pt-4">
        <h3 className={sectionTitle}>
          <ShieldAlert className="h-4 w-4" /> Anti-Cheat
        </h3>
        <div className="grid gap-2 md:grid-cols-2">
          <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <input type="checkbox" checked={Boolean(settings.anti_cheat_tab_switch)} onChange={() => toggle("anti_cheat_tab_switch")} />
            Warn on tab switching
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <input type="checkbox" checked={Boolean(settings.anti_cheat_multi_tab)} onChange={() => toggle("anti_cheat_multi_tab")} />
            Detect multiple tabs
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <input type="checkbox" checked={Boolean(settings.anti_cheat_disable_copy_paste)} onChange={() => toggle("anti_cheat_disable_copy_paste")} />
            Disable copy/paste
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <input type="checkbox" checked={Boolean(settings.anti_cheat_fullscreen_required)} onChange={() => toggle("anti_cheat_fullscreen_required")} />
            Require fullscreen
          </label>
        </div>
      </section>

      <section className="space-y-2 border-t border-emerald-100 pt-4">
        <label className={labelClass}>Assign to Courses</label>
        <select
          multiple
          value={(settings.course_ids || []).map(String)}
          onChange={(event) => {
            const values = [...event.target.selectedOptions].map((option) => Number(option.value));
            onChange("course_ids", values);
          }}
          className="min-h-[120px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          {instructorCourses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title}
            </option>
          ))}
        </select>
        <p className={helperClass}>Hold Ctrl/Cmd to select multiple courses.</p>
      </section>
    </div>
  );
}
