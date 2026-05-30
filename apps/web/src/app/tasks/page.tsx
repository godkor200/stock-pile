import fs from 'fs';
import path from 'path';

interface Task {
  id: string;
  label: string;
  done: boolean;
  details: string[];
}

interface Section {
  title: string;
  tasks: Task[];
}

function parseTasks(md: string): Section[] {
  const lines = md.split('\n');
  const sections: Section[] = [];
  let current: Section | null = null;
  let currentTask: Task | null = null;

  for (const line of lines) {
    // ## 섹션 헤더
    if (line.startsWith('## ')) {
      const title = line.replace(/^##\s+/, '').trim();
      // 메모 섹션은 건너뜀
      if (title === '메모') { current = null; currentTask = null; continue; }
      current = { title, tasks: [] };
      sections.push(current);
      currentTask = null;
      continue;
    }

    // - [x] 또는 - [ ] 태스크
    const taskMatch = line.match(/^- \[(x| )\] (.+)/);
    if (taskMatch && current) {
      const done = taskMatch[1] === 'x';
      const raw = taskMatch[2].trim();
      // T-XX: 형태에서 ID 추출
      const idMatch = raw.match(/^(T-\d+):\s*/);
      const id = idMatch ? idMatch[1] : '';
      const label = idMatch ? raw.replace(idMatch[0], '') : raw;
      currentTask = { id, label, done, details: [] };
      current.tasks.push(currentTask);
      continue;
    }

    // 들여쓰기 서브태스크
    if (line.match(/^\s{2,}-\s/) && currentTask) {
      const detail = line.replace(/^\s+-\s/, '').trim();
      if (detail && !detail.startsWith('```')) {
        currentTask.details.push(detail);
      }
      continue;
    }
  }

  return sections.filter((s) => s.tasks.length > 0);
}

export default function TasksPage() {
  const tasksPath = path.resolve(process.cwd(), '../../TASKS.md');
  const md = fs.readFileSync(tasksPath, 'utf-8');
  const sections = parseTasks(md);

  const allTasks = sections.flatMap((s) => s.tasks);
  const done = allTasks.filter((t) => t.done).length;
  const total = allTasks.length;
  const pct = Math.round((done / total) * 100);

  const lastUpdated = fs.statSync(tasksPath).mtime;

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-end justify-between mb-1">
          <h1 className="text-xl font-semibold text-gray-900">개발 현황</h1>
          <span className="text-xs text-gray-400">
            {lastUpdated.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} 업데이트
          </span>
        </div>
        {/* Progress bar */}
        <div className="flex items-center gap-3 mt-3">
          <div className="flex-1 bg-gray-100 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-sm font-medium text-gray-600 shrink-0">
            {done} / {total}
          </span>
          <span className="text-sm text-gray-400 shrink-0">{pct}%</span>
        </div>
      </div>

      {/* Sections */}
      {sections.map((section) => (
        <div key={section.title} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-600">{section.title}</h2>
            <span className="text-xs text-gray-400">
              {section.tasks.filter((t) => t.done).length} / {section.tasks.length}
            </span>
          </div>
          <ul className="divide-y divide-gray-50">
            {section.tasks.map((task, i) => (
              <li key={i} className="px-5 py-3">
                <div className="flex items-start gap-3">
                  {task.done ? (
                    <span className="mt-0.5 shrink-0 w-4 h-4 rounded-full bg-green-100 flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  ) : (
                    <span className="mt-0.5 shrink-0 w-4 h-4 rounded-full border-2 border-gray-300" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {task.id && (
                        <span className="text-xs text-gray-400 font-mono shrink-0">{task.id}</span>
                      )}
                      <span className={`text-sm ${task.done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                        {task.label}
                      </span>
                    </div>
                    {!task.done && task.details.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5">
                        {task.details.map((d, j) => (
                          <li key={j} className="text-xs text-gray-400 flex items-start gap-1.5">
                            <span className="shrink-0 mt-1">·</span>
                            <span>{d}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <p className="text-center text-xs text-gray-400 pb-4">
        TASKS.md 기반 자동 생성 · 커밋할 때마다 갱신
      </p>
    </div>
  );
}
