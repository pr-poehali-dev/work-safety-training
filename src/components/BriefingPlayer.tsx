import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { Progress } from "@/components/ui/progress";
import type {
  BriefingData,
  Block,
  TaskMatchBlock,
  TaskSortBlock,
  TaskQuizBlock,
} from "@/data/briefings";

// ─── Интерактивные задания ────────────────────────────────────────────────────

function TaskMatch({ block, onDone }: { block: TaskMatchBlock; onDone: () => void }) {
  const [shuffled] = useState(() => [...block.pairs].sort(() => Math.random() - 0.5));
  const [selections, setSelections] = useState<Record<number, number | null>>({});
  const [checked, setChecked] = useState(false);

  const allSelected = Object.keys(selections).length === block.pairs.length &&
    Object.values(selections).every(v => v !== null && v !== undefined);

  const check = () => setChecked(true);

  useEffect(() => {
    if (checked) {
      const allCorrect = block.pairs.every((pair, i) => {
        const sel = selections[i];
        return sel !== null && sel !== undefined && shuffled[sel].right === pair.right;
      });
      if (allCorrect) setTimeout(onDone, 800);
    }
  }, [checked]);

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-mono uppercase tracking-widest text-amber-700 font-semibold">Задание</span>
      </div>
      <h3 className="font-semibold text-sm mb-1">{block.title}</h3>
      <p className="text-xs text-muted-foreground mb-4">{block.instruction}</p>

      <div className="space-y-2.5">
        {block.pairs.map((pair, i) => {
          const sel = selections[i];
          const isCorrect = checked && sel !== null && sel !== undefined && shuffled[sel].right === pair.right;
          const isWrong = checked && sel !== null && sel !== undefined && shuffled[sel].right !== pair.right;
          return (
            <div key={i} className="flex items-center gap-2 flex-wrap">
              <span className={`flex-1 min-w-[120px] px-3 py-2 rounded-lg border text-sm font-medium ${
                isCorrect ? "border-green-400 bg-green-50 text-green-800" :
                isWrong ? "border-red-300 bg-red-50 text-red-700" :
                "border-border bg-white"
              }`}>
                {pair.left}
              </span>
              <Icon name="ArrowRight" size={14} className="text-muted-foreground shrink-0" fallback="Circle" />
              <select
                disabled={checked}
                value={sel ?? ""}
                onChange={e => setSelections(prev => ({ ...prev, [i]: Number(e.target.value) }))}
                className={`flex-1 min-w-[120px] px-3 py-2 rounded-lg border text-sm bg-white ${
                  isCorrect ? "border-green-400 text-green-800" :
                  isWrong ? "border-red-400 text-red-700" :
                  "border-border"
                }`}
              >
                <option value="">— выбрать —</option>
                {shuffled.map((s, si) => (
                  <option key={si} value={si}>{s.right}</option>
                ))}
              </select>
              {checked && (
                <Icon
                  name={isCorrect ? "CheckCircle" : "XCircle"}
                  size={16}
                  className={isCorrect ? "text-green-500 shrink-0" : "text-red-500 shrink-0"}
                  fallback="Circle"
                />
              )}
            </div>
          );
        })}
      </div>

      {!checked ? (
        <button
          disabled={!allSelected}
          onClick={check}
          className="mt-4 px-4 py-2 text-sm rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Проверить
        </button>
      ) : (
        <div className="mt-4 space-y-2">
          {block.pairs.map((pair, i) => {
            const sel = selections[i];
            const isCorrect = sel !== null && sel !== undefined && shuffled[sel].right === pair.right;
            if (!isCorrect) {
              return (
                <p key={i} className="text-xs text-red-700 bg-red-50 rounded px-3 py-1.5">
                  <span className="font-medium">«{pair.left}»</span> → правильный ответ: <span className="font-medium">«{pair.right}»</span>
                </p>
              );
            }
            return null;
          })}
          <button onClick={onDone} className="mt-1 px-4 py-2 text-sm rounded-md bg-primary text-white hover:bg-primary/90 transition-colors">
            Продолжить →
          </button>
        </div>
      )}
    </div>
  );
}

function TaskSort({ block, onDone }: { block: TaskSortBlock; onDone: () => void }) {
  const [selected, setSelected] = useState<boolean[]>(Array(block.items.length).fill(false));
  const [checked, setChecked] = useState(false);

  const toggle = (i: number) => {
    if (checked) return;
    setSelected(prev => prev.map((v, idx) => idx === i ? !v : v));
  };

  const correct = block.items.filter(it => it.correct).length;
  const userCorrect = block.items.filter((it, i) => it.correct === selected[i]).length;
  const score = Math.round((userCorrect / block.items.length) * 100);

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-mono uppercase tracking-widest text-blue-700 font-semibold">Задание</span>
      </div>
      <h3 className="font-semibold text-sm mb-1">{block.title}</h3>
      <p className="text-xs text-muted-foreground mb-4">{block.instruction} (отметьте все подходящие)</p>

      <div className="space-y-2">
        {block.items.map((item, i) => {
          const isSel = selected[i];
          const isCorrect = checked && item.correct === isSel;
          const isWrong = checked && item.correct !== isSel;
          return (
            <div
              key={i}
              onClick={() => toggle(i)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border-2 cursor-pointer transition-all text-sm ${
                isCorrect ? "border-green-400 bg-green-50" :
                isWrong ? "border-red-300 bg-red-50" :
                isSel ? "border-blue-400 bg-blue-50" :
                "border-border bg-white hover:border-blue-300"
              }`}
            >
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                isSel ? "bg-blue-500 border-blue-500" : "border-muted-foreground/30"
              }`}>
                {isSel && <Icon name="Check" size={11} className="text-white" fallback="Check" />}
              </div>
              <span className={isWrong ? "line-through text-muted-foreground" : ""}>{item.text}</span>
              {checked && (
                <span className="ml-auto shrink-0">
                  {isCorrect
                    ? <Icon name="CheckCircle" size={15} className="text-green-500" fallback="Circle" />
                    : isWrong
                    ? <Icon name="XCircle" size={15} className="text-red-500" fallback="Circle" />
                    : null}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {!checked ? (
        <button
          onClick={() => setChecked(true)}
          className="mt-4 px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          Проверить
        </button>
      ) : (
        <div className="mt-4">
          <p className={`text-sm font-medium mb-2 ${score >= 70 ? "text-green-700" : "text-red-600"}`}>
            Верно {userCorrect} из {block.items.length} • {score}%
          </p>
          <div className="text-xs text-muted-foreground mb-3">
            Правильные варианты: {block.items.filter(it => it.correct).map(it => `«${it.text}»`).join(", ")}
          </div>
          <button onClick={onDone} className="px-4 py-2 text-sm rounded-md bg-primary text-white hover:bg-primary/90 transition-colors">
            Продолжить →
          </button>
        </div>
      )}
    </div>
  );
}

function TaskQuiz({ block, onDone }: { block: TaskQuizBlock; onDone: () => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const isCorrect = selected === block.correct;

  return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-mono uppercase tracking-widest text-green-700 font-semibold">Проверь себя</span>
      </div>
      <h3 className="font-semibold text-sm mb-3">{block.question}</h3>

      <div className="space-y-2 mb-4">
        {block.options.map((opt, oi) => {
          const isSel = selected === oi;
          const isRight = oi === block.correct;
          const show = checked;
          return (
            <button
              key={oi}
              disabled={checked}
              onClick={() => setSelected(oi)}
              className={`w-full text-left px-3 py-2.5 rounded-lg border-2 text-sm transition-all ${
                show && isRight ? "border-green-500 bg-green-100 text-green-800 font-medium" :
                show && isSel && !isRight ? "border-red-400 bg-red-50 text-red-700" :
                isSel ? "border-green-400 bg-green-50" :
                "border-border bg-white hover:border-green-300"
              }`}
            >
              <span className={`inline-flex w-5 h-5 rounded-full border-2 mr-2 items-center justify-center text-xs font-bold ${
                show && isRight ? "border-green-500 bg-green-500 text-white" :
                show && isSel && !isRight ? "border-red-400 bg-red-400 text-white" :
                isSel ? "border-green-400 bg-green-400 text-white" :
                "border-muted-foreground/30"
              }`}>
                {String.fromCharCode(65 + oi)}
              </span>
              {opt}
            </button>
          );
        })}
      </div>

      {!checked && selected !== null && (
        <button onClick={() => setChecked(true)} className="px-4 py-2 text-sm rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors">
          Ответить
        </button>
      )}

      {checked && (
        <div className="space-y-3">
          <div className={`px-3 py-2.5 rounded-lg text-sm ${isCorrect ? "bg-green-100 text-green-800" : "bg-red-50 text-red-700"}`}>
            {isCorrect ? "✓ Верно!" : "✗ Неверно."}
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            <p className="text-xs text-blue-800 leading-relaxed">
              <span className="font-semibold">Пояснение: </span>{block.explanation}
            </p>
          </div>
          <button onClick={onDone} className="px-4 py-2 text-sm rounded-md bg-primary text-white hover:bg-primary/90 transition-colors">
            Продолжить →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Блок видео ───────────────────────────────────────────────────────────────
function VideoBlock({ block, onDone }: { block: Extract<Block, { type: "video" }>; onDone: () => void }) {
  const [watched, setWatched] = useState(false);

  // Определяем src iframe
  let iframeSrc = "";
  if (block.vkVideo) {
    const [oid, vid] = block.vkVideo.split("_");
    iframeSrc = `https://vk.com/video_ext.php?oid=${oid}&id=${vid}&hd=2&autoplay=0`;
  } else if (block.youtubeId) {
    iframeSrc = `https://rutube.ru/play/embed/${block.youtubeId}`;
  }

  const handleWatched = () => {
    setWatched(true);
    onDone();
  };

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="bg-black aspect-video w-full">
        <iframe
          className="w-full h-full"
          src={iframeSrc}
          title={block.title}
          allowFullScreen
          allow="clipboard-write; autoplay"
          frameBorder="0"
        />
      </div>
      <div className="bg-white p-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon name="Play" size={13} className="text-primary" fallback="Circle" />
          <span className="text-xs text-muted-foreground font-mono">{block.duration}</span>
        </div>
        <h3 className="font-semibold text-sm">{block.title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{block.description}</p>
        {!watched ? (
          <button
            onClick={handleWatched}
            className="mt-3 w-full py-2 text-sm rounded-md bg-primary text-white hover:bg-primary/90 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <Icon name="CheckCircle" size={15} fallback="Circle" />
            Видео просмотрено, продолжить →
          </button>
        ) : (
          <div className="mt-3 flex items-center gap-2 text-xs text-green-700 font-medium">
            <Icon name="CheckCircle" size={14} className="text-green-600" fallback="Check" />
            Просмотрено
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Основной компонент плеера ────────────────────────────────────────────────
interface Props {
  briefing: BriefingData;
  onExit: () => void;
  onComplete: (briefingId: string) => void;
}

export default function BriefingPlayer({ briefing, onExit, onComplete }: Props) {
  const [variantId, setVariantId] = useState<string | null>(
    briefing.variants ? null : "default"
  );
  const [blockIndex, setBlockIndex] = useState(0);
  const [completedBlocks, setCompletedBlocks] = useState<Set<number>>(new Set());
  const [finished, setFinished] = useState(false);

  const activeBlocks: Block[] =
    briefing.blocks ??
    (briefing.variants?.find(v => v.id === variantId)?.blocks ?? []);

  const total = activeBlocks.length;
  const progress = total > 0 ? Math.round(((blockIndex + 1) / total) * 100) : 0;

  const markDone = (idx: number) => {
    setCompletedBlocks(prev => {
      const next = new Set(prev);
      next.add(idx);
      return next;
    });
  };

  const goNext = () => {
    markDone(blockIndex);
    if (blockIndex < total - 1) {
      setBlockIndex(i => i + 1);
    } else {
      setFinished(true);
      onComplete(briefing.id);
    }
  };

  const currentBlock = activeBlocks[blockIndex];

  // ── Выбор варианта (первичный) ──────────────────────────────────────────────
  if (briefing.variants && !variantId) {
    return (
      <div className="animate-fade-in max-w-xl mx-auto space-y-6 py-4">
        <button onClick={onExit} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <Icon name="ArrowLeft" size={15} fallback="Circle" />
          Назад к инструктажам
        </button>
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Инструктаж</p>
          <h1 className="text-xl font-semibold">{briefing.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{briefing.subtitle}</p>
        </div>
        <div className="grid gap-3">
          {briefing.variants.map(v => (
            <button
              key={v.id}
              onClick={() => setVariantId(v.id)}
              className="w-full text-left p-5 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold group-hover:text-primary transition-colors">{v.label}</span>
                <Icon name="ChevronRight" size={18} className="text-muted-foreground group-hover:text-primary transition-colors" fallback="Circle" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{v.blocks.length} блоков · {briefing.duration} мин</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Экран завершения ────────────────────────────────────────────────────────
  if (finished) {
    return (
      <div className="animate-fade-in max-w-xl mx-auto text-center space-y-6 py-8">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
          <Icon name="ShieldCheck" size={36} className="text-green-600" fallback="Check" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-green-800">Инструктаж пройден!</h2>
          <p className="text-sm text-muted-foreground mt-1">{briefing.title}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800 text-left space-y-1">
          <p>✓ Изучено блоков: <strong>{total}</strong></p>
          <p>✓ Дата прохождения: <strong>{new Date().toLocaleDateString("ru-RU")}</strong></p>
          <p>✓ Подпись работника фиксируется в журнале инструктажей</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onExit} className="flex-1 py-2.5 text-sm rounded-md bg-primary text-white hover:bg-primary/90 transition-colors font-medium">
            К списку инструктажей
          </button>
        </div>
      </div>
    );
  }

  // ── Основной плеер ──────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={onExit} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <Icon name="ArrowLeft" size={15} fallback="Circle" />
          Выйти
        </button>
        <span className="text-xs font-mono text-muted-foreground">{blockIndex + 1} / {total}</span>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium text-muted-foreground truncate pr-4">{briefing.title}</span>
          <span className="text-xs text-muted-foreground shrink-0">{progress}%</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {activeBlocks.map((_, i) => (
          <button
            key={i}
            onClick={() => setBlockIndex(i)}
            className={`w-6 h-6 rounded text-xs transition-colors ${
              i === blockIndex ? "bg-primary text-white" :
              completedBlocks.has(i) ? "bg-green-500 text-white" :
              "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <div className="animate-fade-in">
        <BlockRenderer block={currentBlock} onNext={goNext} />
      </div>
    </div>
  );
}

// ─── Рендерер блоков ──────────────────────────────────────────────────────────
function BlockRenderer({ block, onNext }: { block: Block; onNext: () => void }) {
  if (!block) return null;

  if (block.type === "text") {
    return (
      <div className="bg-white border border-border rounded-xl p-6 space-y-4">
        {block.title && <h2 className="font-semibold text-base border-b border-border pb-3">{block.title}</h2>}
        <div className="text-sm text-foreground leading-relaxed whitespace-pre-line prose-sm">
          {block.content.split("\n").map((line, i) => {
            const bold = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
            return (
              <p key={i} className={line.startsWith("•") ? "pl-2" : ""}
                dangerouslySetInnerHTML={{ __html: bold || "&nbsp;" }} />
            );
          })}
        </div>
        <button onClick={onNext} className="mt-2 px-5 py-2 text-sm rounded-md bg-primary text-white hover:bg-primary/90 transition-colors font-medium">
          Далее →
        </button>
      </div>
    );
  }

  if (block.type === "warning") {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Icon name="AlertTriangle" size={16} className="text-red-600 shrink-0" fallback="Circle" />
          <h3 className="font-semibold text-sm text-red-800">{block.title}</h3>
        </div>
        <div className="text-sm text-red-700 leading-relaxed whitespace-pre-line space-y-1">
          {block.content.split("\n").map((line, i) => <p key={i}>{line}</p>)}
        </div>
        <button onClick={onNext} className="mt-1 px-4 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors font-medium">
          Понятно, продолжить →
        </button>
      </div>
    );
  }

  if (block.type === "info") {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Icon name="Info" size={16} className="text-blue-600 shrink-0" fallback="Circle" />
          <h3 className="font-semibold text-sm text-blue-800">{block.title}</h3>
        </div>
        <div className="text-sm text-blue-800 leading-relaxed space-y-1">
          {block.content.split("\n").map((line, i) => <p key={i}>{line}</p>)}
        </div>
        <button onClick={onNext} className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium">
          Далее →
        </button>
      </div>
    );
  }

  if (block.type === "video") {
    return <VideoBlock block={block} onDone={onNext} />;
  }

  if (block.type === "task_match") {
    return <TaskMatch block={block as TaskMatchBlock} onDone={onNext} />;
  }

  if (block.type === "task_sort") {
    return <TaskSort block={block as TaskSortBlock} onDone={onNext} />;
  }

  if (block.type === "task_quiz") {
    return <TaskQuiz block={block as TaskQuizBlock} onDone={onNext} />;
  }

  return null;
}