import { useMemo, useState, useEffect } from "react";
import { ProgramJob, MeetingLog, UserAccount } from "../types";
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend 
} from "recharts";
import { 
  PlusCircle, 
  TrendingUp, 
  Activity, 
  AlertTriangle, 
  AlertCircle,
  Flame, 
  Lock, 
  CheckCircle2,
  X,
  ListTodo,
  Sun,
  Sunset,
  Moon,
  Sparkles
} from "lucide-react";

interface DashboardViewProps {
  programs: ProgramJob[];
  logs?: MeetingLog[];
  onAddClick: () => void;
  onEditProgramClick?: (program: ProgramJob) => void;
  onUpdateProgressClick?: (program: ProgramJob) => void;
  currentUser?: UserAccount | null;
}

export default function DashboardView({ 
  programs: rawPrograms, 
  logs, 
  onAddClick, 
  onEditProgramClick,
  onUpdateProgressClick,
  currentUser
}: DashboardViewProps) {
  const [selectedCell, setSelectedCell] = useState<{ probability: number; impact: number } | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [onlyMyPrograms, setOnlyMyPrograms] = useState(false);

  // Dynamic greeting based on user's local time
  const greetingData = useMemo(() => {
    const now = new Date();
    const hours = now.getHours();

    if (hours >= 0 && hours < 12) {
      return {
        greeting: "Good Morning",
        subtext: "Selamat pagi! Siap memantau progres inisiatif strategis KAI hari ini?",
        icon: Sun,
        iconColor: "text-amber-300 fill-amber-300/30",
        bgGradient: "from-[#1e266f] via-[#28338e] to-[#f36e21]",
        badgeText: "MORNING COCKPIT BRIEF"
      };
    } else if (hours >= 12 && hours < 18) {
      return {
        greeting: "Good Afternoon",
        subtext: "Selamat sore! Mari tinjau capaian dan kendala program kerja siang ini.",
        icon: Sunset,
        iconColor: "text-orange-300 fill-orange-300/30",
        bgGradient: "from-[#1e266f] via-[#323f9e] to-[#e65c00]",
        badgeText: "AFTERNOON COCKPIT BRIEF"
      };
    } else {
      return {
        greeting: "Good Evening",
        subtext: "Selamat malam! Pantau ringkasan akhir hari dan eskalasi risiko dengan cepat.",
        icon: Moon,
        iconColor: "text-amber-200 fill-amber-200/30",
        bgGradient: "from-[#131a4e] via-[#1e266f] to-[#40206e]",
        badgeText: "EVENING COCKPIT BRIEF"
      };
    }
  }, []);

  const getUserDisplayName = () => {
    if (currentUser?.name && currentUser.name.trim() !== "") {
      return currentUser.name;
    }
    if ((currentUser as any)?.displayName && (currentUser as any).displayName.trim() !== "") {
      return (currentUser as any).displayName;
    }
    if (currentUser?.email) {
      const rawName = currentUser.email.split("@")[0];
      return rawName.charAt(0).toUpperCase() + rawName.slice(1);
    }
    return "User";
  };

  const GreetingIcon = greetingData.icon;

  // Dynamically shadow rawPrograms if "Only My Programs" filter is toggled by a PROGRAM_OWNER
  const programs = useMemo(() => {
    if (onlyMyPrograms && currentUser && currentUser.ownerName) {
      const code = currentUser.ownerName.toUpperCase();
      return rawPrograms.filter(p => 
        (p.owner || "").split(",").map(o => o.trim().toUpperCase()).includes(code) ||
        (p.ztPic || "").toUpperCase() === code
      );
    }
    return rawPrograms;
  }, [rawPrograms, onlyMyPrograms, currentUser]);


  // Calculate actual last updated timestamp dynamically based on latest date in programs or logs
  const lastUpdatedText = useMemo(() => {
    const dates: Date[] = [];
    
    // Parse programs' updatedAt fields
    programs.forEach(p => {
      if (p.updatedAt) {
        const normalized = p.updatedAt.replace(' ', 'T');
        const d = new Date(normalized);
        if (!isNaN(d.getTime())) dates.push(d);
      }
    });

    // Parse logs' meetingDate fields
    if (logs) {
      logs.forEach(l => {
        if (l.meetingDate) {
          const normalized = l.meetingDate.replace(' ', 'T');
          const d = new Date(normalized);
          if (!isNaN(d.getTime())) dates.push(d);
        }
      });
    }

    if (dates.length > 0) {
      const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
      const yyyy = maxDate.getFullYear();
      const mm = String(maxDate.getMonth() + 1).padStart(2, "0");
      const dd = String(maxDate.getDate()).padStart(2, "0");
      const hh = String(maxDate.getHours()).padStart(2, "0");
      const min = String(maxDate.getMinutes()).padStart(2, "0");
      
      const today = new Date();
      const isToday = today.getFullYear() === yyyy && (today.getMonth() + 1) === Number(mm) && today.getDate() === Number(dd);
      
      return `${isToday ? "Hari Ini" : `${yyyy}-${mm}-${dd}`} ${hh}:${min}`;
    }

    return "2026-06-21 09:00";
  }, [programs, logs]);

  const getProgramCoordinates = (p: ProgramJob) => {
    // Determine coordinate based on the actual Section 3: Risk Issue fields
    let impact = p.riskImpact || 0;
    let probability = p.riskProbability || 0;

    // Fallback if not populated
    if (!impact || !probability) {
      const level = p.riskLevel || p.priority || "Medium";
      if (level === "Critical") {
        impact = 4;
        probability = 4;
      } else if (level === "High") {
        impact = 3;
        probability = 4;
      } else if (level === "Medium") {
        impact = 3;
        probability = 3;
      } else if (level === "Low") {
        impact = 2;
        probability = 2;
      } else {
        impact = 2;
        probability = 2;
      }
    }

    // Clamp values strictly between 1 and 4
    impact = Math.max(1, Math.min(4, impact));
    probability = Math.max(1, Math.min(4, probability));

    return { probability, impact };
  };

  const selectedCellPrograms = useMemo(() => {
    if (!selectedCell) return [];
    return programs.filter(p => {
      const coords = getProgramCoordinates(p);
      return coords.probability === selectedCell.probability && coords.impact === selectedCell.impact;
    });
  }, [programs, selectedCell]);

  const selectedMetricPrograms = useMemo(() => {
    if (!selectedMetric) return [];
    
    const clusters = [
      "Strategic Transformation",
      "Corporate Culture",
      "Change Management",
      "Investment Governance",
      "Corporate Insight"
    ];
    if (clusters.includes(selectedMetric)) {
      return programs.filter(p => p.cluster === selectedMetric);
    }

    switch (selectedMetric) {
      case "total":
        return programs;
      case "green":
        return programs.filter(p => p.statusTracker === "Green");
      case "yellow":
        return programs.filter(p => p.statusTracker === "Yellow");
      case "red_blocked":
        return programs.filter(p => p.statusTracker === "Red" || p.statusTracker === "Blocked");
      case "decisionPending":
        return programs.filter(p => p.decisionNeeded === "Yes");
      default:
        return [];
    }
  }, [programs, selectedMetric]);

  const getMetricLabel = (metric: string) => {
    switch (metric) {
      case "total": return "Semua Program Initiatives (Total Initiatives)";
      case "green": return "Program dengan Status Aman / On Track (Green)";
      case "yellow": return "Program dengan Kendala Ringan / At Risk (Yellow)";
      case "red_blocked": return "Program dengan Status Kritis (Red + Blocked)";
      case "decisionPending": return "Program Memerlukan Keputusan (Decision Pending)";
      default: return `Daftar Program Cluster: ${metric}`;
    }
  };

  const handleMetricCardClick = (metricName: string) => {
    setSelectedMetric(metricName);
  };

  // Lock body scroll when selectedMetric modal is open
  useEffect(() => {
    if (selectedMetric) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedMetric]);

  
  // 1. Core Summary Metrics
  const metrics = useMemo(() => {
    const total = programs.length;
    const green = programs.filter(p => p.statusTracker === "Green").length;
    const yellow = programs.filter(p => p.statusTracker === "Yellow").length;
    const red = programs.filter(p => p.statusTracker === "Red").length;
    const blocked = programs.filter(p => p.statusTracker === "Blocked").length;
    
    const decisionPending = programs.filter(p => p.decisionNeeded === "Yes").length;

    // Health Index Calculation
    const totalWeighted = (green * 100) + (yellow * 70) + (red * 35) + (blocked * 0);
    const healthIndex = total > 0 ? Math.round(totalWeighted / total) : 0;

    return {
      total,
      green,
      yellow,
      redAndBlocked: red + blocked,
      decisionPending,
      healthIndex
    };
  }, [programs]);

  // 2. Portfolio Status by Cluster
  const clusterStats = useMemo(() => {
    const clusters: ProgramJob["cluster"][] = [
      "Strategic Transformation",
      "Corporate Culture",
      "Change Management",
      "Investment Governance",
      "Corporate Insight"
    ];

    return clusters.map(c => {
      const clusterPrograms = programs.filter(p => p.cluster === c);
      const total = clusterPrograms.length;
      const green = clusterPrograms.filter(p => p.statusTracker === "Green").length;
      const yellow = clusterPrograms.filter(p => p.statusTracker === "Yellow").length;
      const red = clusterPrograms.filter(p => p.statusTracker === "Red").length;
      const blocked = clusterPrograms.filter(p => p.statusTracker === "Blocked").length;
      
      const avgProgress = total > 0 
        ? Math.round(clusterPrograms.reduce((acc, curr) => acc + (curr.progress || 0), 0) / total) 
        : 0;
        
      const criticalOrHigh = clusterPrograms.filter(p => p.priority === "Critical" || p.priority === "High").length;
      const dzIntervention = clusterPrograms.filter(p => p.dzIntervention && p.dzIntervention !== "None" && p.dzIntervention !== "").length;

      return {
        name: c,
        total,
        green,
        yellow,
        red,
        blocked,
        avgProgress,
        criticalOrHigh,
        dzIntervention
      };
    });
  }, [programs]);

  // 3. Top Execution Issues & Decision Needed for DZ (Priority sorted from Critical, High, Medium, to Low)
  const topIssues = useMemo(() => {
    const priorityOrder: Record<string, number> = {
      "Critical": 1,
      "High": 2,
      "Medium": 3,
      "Low": 4
    };

    return [...programs]
      .filter(p => p.priority === "Critical" || p.priority === "High" || p.decisionNeeded === "Yes")
      .sort((a, b) => {
        const scoreA = priorityOrder[a.priority] || 99;
        const scoreB = priorityOrder[b.priority] || 99;
        return scoreA - scoreB;
      })
      .slice(0, 5); // display top 5 prioritized issues
  }, [programs]);

  // 5. Risk Heatmap Calculations
  // We place programs on standard 4x4 heatmap (Probability x Impact) based on their real risk level & status in the program tracker
  const heatmapData = useMemo(() => {
    const grid = Array(4).fill(null).map(() => Array(4).fill(0));
    
    programs.forEach(p => {
      const { probability, impact } = getProgramCoordinates(p);
      // Adjust coordinate scale to index (0 to 3)
      grid[4 - probability][impact - 1] += 1;
    });

    return grid;
  }, [programs]);

  return (
    <div className="space-y-6">

      {/* 0. Welcome / Personal Greeting Banner */}
      <div className={`relative overflow-hidden rounded-xl bg-gradient-to-r ${greetingData.bgGradient} px-3.5 py-2.5 sm:px-5 sm:py-3.5 text-white shadow-md border border-white/15`}>
        {/* Decorative Ambient Background Shapes */}
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/10 blur-xl pointer-events-none" />
        <div className="absolute -bottom-8 right-24 h-24 w-24 rounded-full bg-[#f36e21]/25 blur-lg pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="space-y-0.5 sm:space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 sm:px-2.5 py-0.5 text-[8px] sm:text-[9px] font-mono font-bold uppercase tracking-wider text-white backdrop-blur-md border border-white/20 shrink-0">
                <Sparkles className="h-2.5 w-2.5 text-amber-300 animate-pulse" />
                {greetingData.badgeText}
              </span>
              <span className="text-[8.5px] sm:text-[10px] font-mono text-white/75 truncate">
                • {new Date().toLocaleDateString("id-ID", { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>

            <h1 className="text-sm sm:text-base md:text-lg font-black tracking-tight text-white leading-tight truncate">
              {greetingData.greeting}, <span className="text-amber-300">{getUserDisplayName()}</span>! 👋
            </h1>

            <p className="text-[10px] sm:text-xs text-white/85 font-medium leading-tight max-w-xl truncate hidden xs:block">
              {greetingData.subtext}
            </p>
          </div>

          {/* Right Icon Illustration Badge */}
          <div className="shrink-0 flex items-center">
            <div className="flex h-8 w-8 sm:h-11 sm:w-11 items-center justify-center rounded-lg sm:rounded-xl bg-white/15 backdrop-blur-md border border-white/20 shadow-inner">
              <GreetingIcon className={`h-4 w-4 sm:h-6 sm:w-6 ${greetingData.iconColor} drop-shadow-sm`} />
            </div>
          </div>
        </div>
      </div>

      {/* Standalone Filter for Users with Designated Cluster */}
      {currentUser && currentUser.ownerName && (
        <div className="flex items-center justify-end gap-3 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm max-w-max ml-auto font-sans">
          <span className="text-xs font-bold text-[#1e266f]">Filter Program Saya ({currentUser.ownerName}):</span>
          <button
            type="button"
            onClick={() => setOnlyMyPrograms(!onlyMyPrograms)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              onlyMyPrograms ? "bg-[#f36e21]" : "bg-slate-250"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                onlyMyPrograms ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
          <span className="text-[10px] font-black uppercase text-slate-500 font-mono w-10">
            {onlyMyPrograms ? "AKTIF" : "OFF"}
          </span>
        </div>
      )}
      
      {/* 1. Key Executive Badges/Cards (Responsive Layout) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        
        <div 
          onClick={() => handleMetricCardClick("total")}
          className={`cursor-pointer transition-all duration-200 active:scale-95 bg-slate-900 text-white rounded-lg p-2 sm:p-3 border flex flex-col justify-between shadow-sm min-h-[80px] sm:min-h-[92px] hover:bg-slate-850 hover:border-slate-700 ${
            selectedMetric === "total" ? "ring-2 ring-slate-900 ring-offset-2 scale-[1.03]" : "border-slate-800"
          }`}
        >
          <span className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-wider font-mono font-bold block">
            Total Initiatives
          </span>
          <span className="text-lg sm:text-2xl font-black font-sans my-0.5 sm:my-1 block text-center">
            {metrics.total}
          </span>
          <div className="text-[8px] sm:text-[9px] text-slate-400 mt-auto text-center border-t border-slate-800 pt-1">
            Transformasi Strategis
          </div>
        </div>

        <div 
          onClick={() => handleMetricCardClick("green")}
          className={`cursor-pointer transition-all duration-200 active:scale-95 bg-emerald-50 text-emerald-900 rounded-lg p-2 sm:p-3 border flex flex-col justify-between shadow-sm min-h-[80px] sm:min-h-[92px] hover:bg-emerald-100 hover:border-emerald-300 ${
            selectedMetric === "green" ? "ring-2 ring-emerald-600 ring-offset-2 scale-[1.03]" : "border-emerald-100"
          }`}
        >
          <span className="text-[9px] sm:text-[10px] text-emerald-700 uppercase tracking-wider font-mono font-bold block">
            On Track / Green
          </span>
          <span className="text-lg sm:text-2xl font-black font-sans my-0.5 sm:my-1 block text-center text-emerald-600">
            {metrics.green}
          </span>
          <div className="text-[8px] sm:text-[9px] text-emerald-700 mt-auto text-center border-t border-emerald-100 pt-1">
            Status Berjalan Sehat
          </div>
        </div>

        <div 
          onClick={() => handleMetricCardClick("yellow")}
          className={`cursor-pointer transition-all duration-200 active:scale-95 bg-amber-50 text-amber-900 rounded-lg p-2 sm:p-3 border flex flex-col justify-between shadow-sm min-h-[80px] sm:min-h-[92px] hover:bg-amber-100/80 hover:border-amber-300 ${
            selectedMetric === "yellow" ? "ring-2 ring-amber-500 ring-offset-2 scale-[1.03]" : "border-amber-100"
          }`}
        >
          <span className="text-[9px] sm:text-[10px] text-amber-700 uppercase tracking-wider font-mono font-bold block">
            At Risk / Yellow
          </span>
          <span className="text-lg sm:text-2xl font-black font-sans my-0.5 sm:my-1 block text-center text-amber-600">
            {metrics.yellow}
          </span>
          <div className="text-[8px] sm:text-[9px] text-amber-700 mt-auto text-center border-t border-amber-100 pt-1">
            Terdapat Kendala Ringan
          </div>
        </div>

        <div 
          onClick={() => handleMetricCardClick("red_blocked")}
          className={`cursor-pointer transition-all duration-200 active:scale-95 bg-rose-50 text-rose-900 rounded-lg p-2 sm:p-3 border flex flex-col justify-between shadow-sm min-h-[80px] sm:min-h-[92px] hover:bg-rose-100 hover:border-rose-250 ${
            selectedMetric === "red_blocked" ? "ring-2 ring-rose-500 ring-offset-2 scale-[1.03]" : "border-rose-150"
          }`}
        >
          <span className="text-[9px] sm:text-[10px] text-rose-700 uppercase tracking-wider font-mono font-bold block">
            BLOCKED + RED
          </span>
          <span className="text-lg sm:text-2xl font-black font-sans my-0.5 sm:my-1 block text-center text-rose-600">
            {metrics.redAndBlocked}
          </span>
          <div className="text-[8px] sm:text-[9px] text-rose-700 mt-auto text-center border-t border-rose-100 pt-1">
            Perlu Intervensi Segera
          </div>
        </div>

        <div 
          onClick={() => handleMetricCardClick("decisionPending")}
          className={`cursor-pointer transition-all duration-200 active:scale-95 bg-slate-50 text-slate-900 rounded-lg p-2 sm:p-3 border flex flex-col justify-between shadow-sm min-h-[80px] sm:min-h-[92px] hover:bg-slate-100 hover:border-slate-300 col-span-2 sm:col-span-1 ${
            selectedMetric === "decisionPending" ? "ring-2 ring-slate-800 ring-offset-2 scale-[1.03]" : "border-slate-200"
          }`}
        >
          <span className="text-[9px] sm:text-[10px] text-slate-500 uppercase tracking-wider font-mono font-bold block">
            Decision Pending
          </span>
          <span className="text-lg sm:text-2xl font-black font-sans my-0.5 sm:my-1 block text-center text-slate-800">
            {metrics.decisionPending}
          </span>
          <div className="text-[8px] sm:text-[9px] text-slate-500 mt-auto text-center border-t border-slate-200 pt-1">
            Butuh Keputusan DZ
          </div>
        </div>

      </div>



      {/* 2. Top Execution Issues Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-red-500 animate-pulse flex-shrink-0" />
            <h3 className="text-xs font-bold font-sans text-slate-800 uppercase tracking-wider leading-relaxed">
              Top Execution Issues & Decision Required For DZ (Klik baris untuk Detail)
            </h3>
          </div>
          <span className="text-[10px] bg-red-50 text-red-700 font-mono font-bold px-2 py-0.5 rounded self-start sm:self-auto shrink-0">
            Escalation Needed
          </span>
        </div>
        
        <div className="overflow-x-auto">
          {topIssues.length === 0 ? (
            <p className="text-slate-400 text-xs py-4 text-center font-mono">
              Tidak ada isu mendesak berprioritas Kritikal/Tinggi saat ini.
            </p>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block">
                <table className="w-full text-left text-xs font-sans min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-mono text-slate-500 font-bold">
                      <th className="py-2 px-3 w-20">Priority</th>
                      <th className="py-2 px-3 w-40 bg-indigo-50/50 text-indigo-900 font-bold border-r border-indigo-100/30">Topic</th>
                      <th className="py-2 px-3">Issue</th>
                      <th className="py-2 px-3">Impact</th>
                      <th className="py-2 px-3">ZT Recommendation</th>
                      <th className="py-2 px-3">Clear the Path</th>
                      <th className="py-2 px-3 w-28">Deadline</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 divide-slate-200">
                    {topIssues.map((issue) => (
                      <tr 
                        key={issue.id} 
                        onClick={() => (onUpdateProgressClick || onEditProgramClick)?.(issue)}
                        className="hover:bg-slate-100 cursor-pointer transition-colors"
                        title="Klik untuk melihat detail lengkap program"
                      >
                        <td className="py-3 px-3">
                          <span className="px-2 py-1 rounded text-[10px] font-bold block text-center border font-sans"
                            style={{
                              backgroundColor: 
                                issue.priority === "Critical" ? "#fef2f2" : 
                                issue.priority === "High" ? "#fff7ed" : 
                                issue.priority === "Medium" ? "#eff6ff" : "#f8fafc",
                              color: 
                                issue.priority === "Critical" ? "#b91c1c" : 
                                issue.priority === "High" ? "#c2410c" : 
                                issue.priority === "Medium" ? "#1d4ed8" : "#475569",
                              borderColor: 
                                issue.priority === "Critical" ? "#fecaca" : 
                                issue.priority === "High" ? "#fed7aa" : 
                                issue.priority === "Medium" ? "#bfdbfe" : "#e2e8f0"
                            }}
                          >
                            {issue.priority === "Critical" ? "P1 (Critical)" : 
                             issue.priority === "High" ? "P2 (High)" : 
                             issue.priority === "Medium" ? "P3 (Medium)" : 
                             issue.priority === "Low" ? "P4 (Low)" : (issue.priority || "P3 (Medium)")}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-bold text-[#1e266f] bg-indigo-50/30 border-r border-indigo-100/30">{issue.topic}</td>
                        <td className="py-3 px-3 text-slate-700">{issue.keyIssue || "N/A"}</td>
                        <td className="py-3 px-3 text-slate-600 text-[11px] leading-relaxed">{issue.strategicImpact}</td>
                        <td className="py-3 px-3 text-slate-700">{issue.actionPlan || "N/A"}</td>
                        <td className="py-3 px-3 font-semibold text-slate-900">{issue.clearThePath || "None"}</td>
                        <td className="py-3 px-3 font-mono text-slate-650 font-bold">{issue.deadline}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div className="flex flex-col lg:hidden gap-4 max-h-[580px] overflow-y-auto snap-y pr-1 pb-3 scrollbar-thin">
                {topIssues.map((issue, index) => {
                  const isCritical = issue.priority === "Critical";
                  const isHigh = issue.priority === "High";
                  const isMedium = issue.priority === "Medium";
                  const priorityBg = 
                    isCritical ? "bg-rose-50 text-rose-700 border-rose-200" : 
                    isHigh ? "bg-amber-50 text-amber-700 border-amber-200" :
                    isMedium ? "bg-sky-50 text-sky-700 border-sky-200" :
                    "bg-slate-50 text-slate-500 border-slate-200";
                  const priorityLabel = 
                    issue.priority === "Critical" ? "P1 (Critical)" :
                    issue.priority === "High" ? "P2 (High)" :
                    issue.priority === "Medium" ? "P3 (Medium)" :
                    issue.priority === "Low" ? "P4 (Low)" : (issue.priority || "P3 (Medium)");
                  
                  return (
                    <div 
                      key={issue.id}
                      onClick={() => (onUpdateProgressClick || onEditProgramClick)?.(issue)}
                      className={`w-full bg-white border rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all active:scale-[0.99] cursor-pointer flex flex-col snap-start shrink-0 ${
                        isCritical ? "border-l-4 border-l-rose-500 border-slate-200" :
                        isHigh ? "border-l-4 border-l-amber-500 border-slate-200" :
                        isMedium ? "border-l-4 border-l-sky-500 border-slate-200" :
                        "border-l-4 border-l-slate-400 border-slate-200"
                      }`}
                    >
                      {/* Card Header: Program Counter, Cluster, Priority & Target */}
                      <div className="p-3.5 bg-slate-50/90 border-b border-slate-100 flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[9.5px] font-black text-indigo-900 bg-indigo-100/90 border border-indigo-200/80 px-2 py-0.5 rounded-md font-mono">
                              Program #{index + 1} dari {topIssues.length}
                            </span>
                            <span className="text-[9px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md uppercase tracking-wider">
                              {issue.cluster}
                            </span>
                          </div>
                          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded border shadow-2xs ${priorityBg}`}>
                            {priorityLabel}
                          </span>
                        </div>

                        {/* Inisiatif Program Name */}
                        <div className="space-y-0.5 mt-0.5">
                          <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-wider block">
                            INISIATIF PROGRAM:
                          </span>
                          <h4 className="text-sm font-extrabold text-[#1e266f] leading-snug tracking-tight">
                            {issue.topic}
                          </h4>
                        </div>

                        {/* Progress Bar & Target Date */}
                        <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-100/80 mt-1">
                          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500">
                            <span>Target:</span>
                            <strong className="text-slate-800 font-bold">{issue.deadline || "-"}</strong>
                          </div>

                          {typeof issue.progress === "number" && (
                            <div className="flex items-center gap-2 min-w-[100px]">
                              <div className="flex-1 bg-slate-200/70 rounded-full h-1.5 overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    issue.progress >= 80 ? "bg-emerald-500" :
                                    issue.progress >= 50 ? "bg-amber-500" : "bg-rose-500"
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(0, issue.progress))}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-mono font-extrabold text-slate-700 shrink-0">
                                {issue.progress}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Body Details - All Columns Displayed */}
                      <div className="p-3.5 space-y-3 text-xs text-slate-600">
                        {/* 1. Isu Utama & Tantangan */}
                        <div>
                          <span className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                            Isu Utama & Tantangan
                          </span>
                          <p className="bg-slate-50/90 p-2.5 rounded-lg border border-slate-200/80 font-medium text-slate-800 leading-relaxed text-xs">
                            {issue.keyIssue || "Tidak ada isu khusus"}
                          </p>
                        </div>

                        {/* 2. Dampak Strategis */}
                        <div>
                          <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                            Dampak Strategis
                          </span>
                          <p className="bg-slate-50/50 p-2 rounded-lg border border-slate-100 text-slate-700 leading-relaxed text-[11px] font-normal">
                            {issue.strategicImpact || "Tidak dicantumkan"}
                          </p>
                        </div>

                        {/* 3. Rekomendasi ZT / Action Plan */}
                        <div>
                          <span className="block text-[9px] font-extrabold text-indigo-700 uppercase tracking-wider mb-1">
                            Rekomendasi ZT (Action Plan)
                          </span>
                          <p className="bg-indigo-50/40 text-indigo-950 p-2.5 rounded-lg border border-indigo-150/80 font-medium leading-relaxed text-xs">
                            {issue.actionPlan || "-"}
                          </p>
                        </div>

                        {/* 4. Clear the Path / Keputusan DZ Needed */}
                        <div className="bg-rose-50/70 border border-rose-200 p-2.5 rounded-lg shadow-2xs">
                          <span className="block text-[9px] font-extrabold text-rose-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
                            Clear the Path (Keputusan DZ)
                          </span>
                          <p className="font-bold text-slate-900 leading-relaxed text-xs">
                            {issue.clearThePath || "Belum ada keputusan khusus"}
                          </p>
                        </div>
                      </div>

                      {/* Card Footer: Owner & Detail Link */}
                      <div className="px-3.5 py-2.5 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                        <span>Penanggung Jawab: <strong className="text-slate-800 font-bold">{issue.owner || "-"}</strong></span>
                        <span className="text-indigo-600 font-extrabold hover:underline flex items-center gap-0.5">
                          Klik Detail &rarr;
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Selected Risk Heatmap Details Table */}
      {selectedCell && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 shadow-xs transition-all duration-300">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#1e266f]"></span>
              <div>
                <h3 className="text-xs font-bold font-sans text-slate-850 uppercase tracking-wider">
                  Detail Program Risiko: Probabilitas {selectedCell.probability} & Dampak {selectedCell.impact}
                </h3>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                  Ditemukan {selectedCellPrograms.length} program pada sel koordinat ini
                </p>
              </div>
            </div>
            <button 
              onClick={() => setSelectedCell(null)}
              className="p-1.5 hover:bg-slate-100 rounded-full transition-colors cursor-pointer text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {selectedCellPrograms.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs font-mono">
              Tidak ada program yang berada di koordinat risiko ini.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans min-w-[750px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200/80 font-mono text-slate-500 font-bold">
                    <th className="py-2 px-3 w-12 text-center">No</th>
                    <th className="py-2 px-3 bg-indigo-50/50 text-indigo-900 font-bold border-r border-indigo-100/30">Topic</th>
                    <th className="py-2 px-3">Cluster</th>
                    <th className="py-2 px-3">Owner / PIC</th>
                    <th className="py-2 px-3">Phase</th>
                    <th className="py-2 px-3 text-center">Progress</th>
                    <th className="py-2 px-3 text-center">Status</th>
                    <th className="py-2 px-3 text-center">Priority</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedCellPrograms.map((item, index) => {
                    return (
                      <tr 
                        key={item.id} 
                        onClick={() => (onUpdateProgressClick || onEditProgramClick)?.(item)}
                        className="hover:bg-slate-100 cursor-pointer transition-colors"
                        title="Klik untuk melihat detail lengkap program"
                      >
                        <td className="py-3 px-3 text-center font-mono text-slate-500 font-medium">{index + 1}</td>
                        <td className="py-3 px-3 font-bold text-[#1e266f] bg-indigo-50/30 border-r border-indigo-100/30">{item.topic}</td>
                        <td className="py-3 px-3 text-slate-600 font-medium">{item.cluster}</td>
                        <td className="py-3 px-3 text-slate-500">{item.owner}</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-medium border border-slate-200/50">
                            {item.phase}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 bg-slate-200 rounded-full h-1.5 hidden md:block">
                              <div className="bg-[#1e266f] h-1.5 rounded-full" style={{ width: `${item.progress}%` }}></div>
                            </div>
                            <span className="font-mono text-[10px] font-bold text-slate-700">
                              {item.progress}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block`}
                            style={{
                              backgroundColor: item.statusTracker === "Green" ? "#ecfdf5" : item.statusTracker === "Yellow" ? "#fffbeb" : item.statusTracker === "Red" ? "#fef2f2" : "#f1f5f9",
                              color: item.statusTracker === "Green" ? "#047857" : item.statusTracker === "Yellow" ? "#b45309" : item.statusTracker === "Red" ? "#b91c1c" : "#475569"
                            }}
                          >
                            {item.statusTracker}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold inline-block border`}
                            style={{
                              backgroundColor: 
                                item.priority === "Critical" ? "#fef2f2" : 
                                item.priority === "High" ? "#fff7ed" : 
                                item.priority === "Medium" ? "#eff6ff" : "#f8fafc",
                              color: 
                                item.priority === "Critical" ? "#b91c1c" : 
                                item.priority === "High" ? "#c2410c" : 
                                item.priority === "Medium" ? "#1d4ed8" : "#475569",
                              borderColor: 
                                item.priority === "Critical" ? "#fecaca" : 
                                item.priority === "High" ? "#fed7aa" : 
                                item.priority === "Medium" ? "#bfdbfe" : "#e2e8f0"
                            }}
                          >
                            {item.priority === "Critical" ? "P1 (Critical)" : 
                             item.priority === "High" ? "P2 (High)" : 
                             item.priority === "Medium" ? "P3 (Medium)" : 
                             item.priority === "Low" ? "P4 (Low)" : (item.priority || "P3 (Medium)")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Selected Metric Details Pop-up Modal Overlay */}
      {selectedMetric && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 bg-slate-900/60 backdrop-blur-xs overscroll-contain overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setSelectedMetric(null)}
        >
          <div 
            className="bg-white rounded-2xl border border-slate-200 w-full max-w-5xl max-h-[85vh] sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 font-sans my-auto shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-[#1e266f] border-b-2 border-[#f36e21] px-4 sm:px-6 py-3.5 text-white flex items-center justify-between shrink-0 shadow-sm">
              <div className="flex items-center gap-3 min-w-0 pr-2">
                <div className="p-2 bg-[#f36e21] text-white rounded-xl shrink-0 shadow-2xs">
                  <ListTodo className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xs sm:text-sm font-black tracking-tight text-white uppercase truncate">
                      {getMetricLabel(selectedMetric)}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#f36e21] text-white text-[10px] font-black font-mono shrink-0 shadow-2xs">
                      {selectedMetricPrograms.length} Inisiatif
                    </span>
                  </div>
                  <p className="text-[10px] text-orange-100/90 font-medium truncate mt-0.5">
                    Klik pada baris atau kartu program untuk membuka detail lengkap dan update MoM
                  </p>
                </div>
              </div>

              <button 
                type="button"
                onClick={() => setSelectedMetric(null)}
                className="p-1.5 hover:bg-white/20 text-white/80 hover:text-white rounded-lg transition-colors cursor-pointer shrink-0"
                title="Tutup Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Content */}
            <div className="p-3.5 sm:p-5 overflow-y-auto min-h-0 flex-1 space-y-3 bg-slate-50/50 overscroll-contain touch-pan-y">
              {selectedMetricPrograms.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs font-mono bg-white rounded-xl border border-slate-200/80 p-6">
                  Tidak ada program yang berada di kategori ini.
                </div>
              ) : (
                <>
                  {/* Desktop Table View (>= md) */}
                  <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-2xs">
                    <table className="w-full text-left text-xs font-sans">
                      <thead>
                        <tr className="bg-[#1e266f]/10 border-b border-[#1e266f]/20 font-mono text-[#1e266f] font-bold">
                          <th className="py-2.5 px-3 w-12 text-center">No</th>
                          <th className="py-2.5 px-3 bg-[#1e266f]/15 text-[#1e266f] font-extrabold border-r border-[#1e266f]/20">Topic Inisiatif</th>
                          <th className="py-2.5 px-3">Cluster</th>
                          <th className="py-2.5 px-3">Unit Owner</th>
                          <th className="py-2.5 px-3">Phase</th>
                          
                          {/* Dynamic Headers based on selected metric */}
                          {selectedMetric === "decisionPending" ? (
                            <>
                              <th className="py-2.5 px-3 text-center">Decision Needed</th>
                              <th className="py-2.5 px-3">Key Issue & Decision Required</th>
                              <th className="py-2.5 px-3">Action Plan / Recommendation</th>
                            </>
                          ) : (
                            <>
                              <th className="py-2.5 px-3 text-center">Progress</th>
                              <th className="py-2.5 px-3 text-center">Status Tracker</th>
                              <th className="py-2.5 px-3 text-center">Priority</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedMetricPrograms.map((item, index) => {
                          return (
                            <tr 
                              key={item.id} 
                              onClick={() => {
                                setSelectedMetric(null);
                                (onUpdateProgressClick || onEditProgramClick)?.(item);
                              }}
                              className="hover:bg-orange-50/50 transition-colors cursor-pointer group"
                              title="Klik untuk membuka detail lengkap program"
                            >
                              <td className="py-3 px-3 text-center font-mono text-slate-500 font-medium">{index + 1}</td>
                              <td className="py-3 px-3 font-extrabold text-[#1e266f] bg-orange-50/30 border-r border-orange-100 group-hover:text-[#f36e21]">
                                {item.topic}
                              </td>
                              <td className="py-3 px-3 text-slate-600 font-medium">{item.cluster}</td>
                              <td className="py-3 px-3 text-slate-500">{item.owner}</td>
                              <td className="py-3 px-3">
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200/60">
                                  {item.phase}
                                </span>
                              </td>

                              {/* Dynamic Body Cells */}
                              {selectedMetric === "decisionPending" ? (
                                <>
                                  <td className="py-3 px-3 text-center">
                                    <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 font-bold text-[10px]">
                                      {item.decisionNeeded || "Yes"}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3 text-slate-700 font-medium max-w-[200px] truncate" title={item.keyIssue}>
                                    {item.keyIssue || "-"}
                                  </td>
                                  <td className="py-3 px-3 text-slate-600 max-w-[200px] truncate" title={item.actionPlan}>
                                    {item.actionPlan || "-"}
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="py-3 px-3">
                                    <div className="flex items-center justify-center gap-2">
                                      <div className="w-16 bg-slate-200 rounded-full h-1.5 hidden md:block">
                                        <div className="bg-[#f36e21] h-1.5 rounded-full" style={{ width: `${item.progress}%` }}></div>
                                      </div>
                                      <span className="font-mono text-[10px] font-bold text-slate-700">
                                        {item.progress}%
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold inline-block`}
                                      style={{
                                        backgroundColor: item.statusTracker === "Green" ? "#ecfdf5" : item.statusTracker === "Yellow" ? "#fffbeb" : item.statusTracker === "Red" ? "#fef2f2" : "#f1f5f9",
                                        color: item.statusTracker === "Green" ? "#047857" : item.statusTracker === "Yellow" ? "#b45309" : item.statusTracker === "Red" ? "#b91c1c" : "#475569"
                                      }}
                                    >
                                      {item.statusTracker}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold inline-block border`}
                                      style={{
                                        backgroundColor: 
                                          item.priority === "Critical" ? "#fef2f2" : 
                                          item.priority === "High" ? "#fff7ed" : 
                                          item.priority === "Medium" ? "#eff6ff" : "#f8fafc",
                                        color: 
                                          item.priority === "Critical" ? "#b91c1c" : 
                                          item.priority === "High" ? "#c2410c" : 
                                          item.priority === "Medium" ? "#1d4ed8" : "#475569",
                                        borderColor: 
                                          item.priority === "Critical" ? "#fecaca" : 
                                          item.priority === "High" ? "#fed7aa" : 
                                          item.priority === "Medium" ? "#bfdbfe" : "#e2e8f0"
                                      }}
                                    >
                                      {item.priority === "Critical" ? "P1 (Critical)" : 
                                       item.priority === "High" ? "P2 (High)" : 
                                       item.priority === "Medium" ? "P3 (Medium)" : 
                                       item.priority === "Low" ? "P4 (Low)" : (item.priority || "P3 (Medium)")}
                                    </span>
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards View (< md) */}
                  <div className="md:hidden space-y-2.5">
                    {selectedMetricPrograms.map((item, index) => (
                      <div 
                        key={item.id}
                        onClick={() => {
                          setSelectedMetric(null);
                          (onUpdateProgressClick || onEditProgramClick)?.(item);
                        }}
                        className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs hover:shadow-md transition-all active:scale-[0.99] cursor-pointer flex flex-col gap-2 hover:border-orange-300"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[9.5px] font-black text-white bg-[#1e266f] border border-[#f36e21]/40 px-2 py-0.5 rounded-md font-mono">
                            #{index + 1} • {item.cluster}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border`}
                            style={{
                              backgroundColor: item.statusTracker === "Green" ? "#ecfdf5" : item.statusTracker === "Yellow" ? "#fffbeb" : item.statusTracker === "Red" ? "#fef2f2" : "#f1f5f9",
                              color: item.statusTracker === "Green" ? "#047857" : item.statusTracker === "Yellow" ? "#b45309" : item.statusTracker === "Red" ? "#b91c1c" : "#475569",
                              borderColor: item.statusTracker === "Green" ? "#a7f3d0" : item.statusTracker === "Yellow" ? "#fde68a" : item.statusTracker === "Red" ? "#fca5a5" : "#cbd5e1"
                            }}
                          >
                            {item.statusTracker}
                          </span>
                        </div>

                        <h4 className="text-xs sm:text-sm font-extrabold text-[#1e266f] leading-snug">
                          {item.topic}
                        </h4>

                        <div className="flex items-center justify-between gap-2 text-[10.5px] text-slate-500 border-t border-slate-100 pt-2 mt-0.5">
                          <span>Owner: <strong className="text-slate-800 font-bold">{item.owner}</strong></span>
                          <span className="font-mono font-extrabold text-[#1e266f] bg-orange-50 border border-orange-200 px-2 py-0.5 rounded">
                            {item.progress}% Completed
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-4 sm:px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-xs font-mono text-slate-600 font-bold">
                Total: <strong className="text-[#f36e21] font-black">{selectedMetricPrograms.length}</strong> Program Inisiatif
              </span>
              <button
                type="button"
                onClick={() => setSelectedMetric(null)}
                className="px-5 py-2 bg-[#f36e21] hover:bg-[#e05d10] text-white text-xs font-black rounded-xl transition-colors cursor-pointer shadow-sm active:scale-95"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Transformation Health Index & Risk Heatmap Matrix Side-by-Side */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Side: Transformation Health Index (Custom Gauge) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-black font-sans text-[#1e266f] tracking-tight">
              Transformation Health Index
            </h3>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
              Transformation Executive Cockpit Metrics
            </p>
          </div>

          {/* Premium Custom Gauge Visualizer */}
          <div className="my-5 relative flex flex-col items-center">
            {(() => {
              const clampedHealth = Math.max(0, Math.min(100, metrics.healthIndex));
              
              // Dynamic status color configuration following the health metrics logic:
              // >=80 (emerald/green), 65-79 (amber/yellow), <65 (rose/red)
              let statusColorClass = "text-amber-500";
              let statusColorHex = "#f59e0b";
              if (clampedHealth >= 80) {
                statusColorClass = "text-emerald-600";
                statusColorHex = "#10b981";
              } else if (clampedHealth >= 65) {
                statusColorClass = "text-amber-500";
                statusColorHex = "#f59e0b";
              } else {
                statusColorClass = "text-rose-600";
                statusColorHex = "#f43f5e";
              }

              const cx = 100;
              const cy = 100;
              const r = 75;

              // Starting point (0%): 150 degrees
              const startAngleRad = (150 * Math.PI) / 180;
              const x0 = cx + r * Math.cos(startAngleRad);
              const y0 = cy + r * Math.sin(startAngleRad);

              // End point of 100% active: 390 degrees (150 + 240)
              const x100 = cx + r * Math.cos((390 * Math.PI) / 180);
              const y100 = cy + r * Math.sin((390 * Math.PI) / 180);

              // End point of active part at current health percentage
              const activeHealth = Math.max(0.1, clampedHealth);
              const activeAngleDeg = 150 + activeHealth * 2.4;
              const activeAngleRad = (activeAngleDeg * Math.PI) / 180;
              const xp = cx + r * Math.cos(activeAngleRad);
              const yp = cy + r * Math.sin(activeAngleRad);

              // Large arc flag for active path: 1 if active angle span > 180 degrees (i.e. activeHealth > 75)
              const activeLargeArcFlag = activeHealth > 75 ? 1 : 0;

              return (
                <>
                  {/* Gauge Container with Relative Overlay positioning */}
                  <div className="relative w-full max-w-[240px]">
                    <svg viewBox="0 0 200 150" className="w-full h-auto overflow-visible">
                      <defs>
                        {/* High-fidelity continuous color spectrum gradient matching mockup exactly */}
                        <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#f43f5e" /> {/* Red-Rose */}
                          <stop offset="45%" stopColor="#f59e0b" /> {/* Orange/Amber */}
                          <stop offset="75%" stopColor="#eab308" /> {/* Yellow */}
                          <stop offset="100%" stopColor="#10b981" /> {/* Green-Emerald */}
                        </linearGradient>
                      </defs>

                      {/* 1. Full 100% Background path in light grayish-blue */}
                      <path 
                        d={`M ${x0} ${y0} A ${r} ${r} 0 1 1 ${x100} ${y100}`} 
                        fill="none" 
                        stroke="#f1f5f9" 
                        strokeWidth="14" 
                        strokeLinecap="round" 
                      />

                      {/* 2. Active part path layered on top with the continuous gradient */}
                      <path 
                        d={`M ${x0} ${y0} A ${r} ${r} 0 ${activeLargeArcFlag} 1 ${xp} ${yp}`} 
                        fill="none" 
                        stroke="url(#gaugeGradient)" 
                        strokeWidth="14" 
                        strokeLinecap="round" 
                      />

                      {/* 3. Pointer halo and solid indicator dot */}
                      <circle cx={xp} cy={yp} r="11" fill={statusColorHex} fillOpacity="0.25" />
                      <circle cx={xp} cy={yp} r="6.5" fill="#ffffff" stroke={statusColorHex} strokeWidth="3.5" className="shadow-md" />
                    </svg>

                    {/* Absolutely Centered Overlay inside Semi-circle */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pt-8 text-center pointer-events-none">
                      {/* Main Dynamic Large Percentage Metric with status-following text color */}
                      <div className={`text-4.5xl sm:text-5xl font-black tracking-tight ${statusColorClass} leading-none select-none`}>
                        {clampedHealth}%
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Elegant Parameters & Interpretation Block with requested info */}
          <div className="border-t border-slate-100 pt-4 mt-3 text-[11px] text-slate-600 leading-relaxed font-sans space-y-4">
            <div>
              <h4 className="text-xs font-bold text-slate-800 font-sans mb-1.5">Formula Perhitungan:</h4>
              <div className="bg-slate-50 border border-slate-100 rounded-xl py-2.5 px-4 text-center font-mono text-[10px] text-slate-500 tracking-wide select-all">
                Green = 100 | Yellow = 70 | Red = 35 | Blocked = 0
              </div>
              <p className="text-[10px] text-slate-400 italic mt-1.5 leading-tight">
                * Skor dihitung dari rerata bobot status program tracker.
              </p>
            </div>
            
            <div>
              <h4 className="text-xs font-bold text-slate-800 font-sans mb-2">Interpretasi Status:</h4>
              <div className="grid grid-cols-3 gap-2 font-sans text-center">
                {(() => {
                  const clampedHealth = Math.max(0, Math.min(100, metrics.healthIndex));
                  const isSehat = clampedHealth >= 80;
                  const isPerhatian = clampedHealth >= 65 && clampedHealth < 80;
                  const isIntervensi = clampedHealth < 65;

                  return (
                    <>
                      {/* Card 1: Sehat */}
                      <div className={`p-2.5 rounded-xl border transition-all duration-300 ${
                        isSehat 
                          ? "bg-[#f4fbf7] border-[#10b981] border-2 ring-1 ring-[#10b981]/10 shadow-sm" 
                          : "bg-slate-50/50 border-slate-100 text-slate-400"
                      }`}>
                        <span className={`text-xs font-black block ${isSehat ? "text-[#137333]" : "text-slate-500"}`}>&ge;80</span>
                        <span className={`text-[10px] font-bold block mt-0.5 ${isSehat ? "text-[#137333]" : "text-slate-400"}`}>Sehat</span>
                      </div>

                      {/* Card 2: Perhatian */}
                      <div className={`p-2.5 rounded-xl border transition-all duration-300 ${
                        isPerhatian 
                          ? "bg-[#fffbf0] border-[#f59e0b] border-2 ring-1 ring-[#f59e0b]/10 shadow-sm" 
                          : "bg-slate-50/50 border-slate-100 text-slate-400"
                      }`}>
                        <span className={`text-xs font-black block ${isPerhatian ? "text-[#b25e00]" : "text-slate-500"}`}>65-79</span>
                        <span className={`text-[10px] font-bold block mt-0.5 ${isPerhatian ? "text-[#b25e00]" : "text-slate-400"}`}>Perhatian</span>
                      </div>

                      {/* Card 3: Intervensi DZ */}
                      <div className={`p-2.5 rounded-xl border transition-all duration-300 ${
                        isIntervensi 
                          ? "bg-[#fff5f5] border-[#f43f5e] border-2 ring-1 ring-[#f43f5e]/10 shadow-sm" 
                          : "bg-slate-50/50 border-slate-100 text-slate-400"
                      }`}>
                        <span className={`text-xs font-black block ${isIntervensi ? "text-[#c92a2a]" : "text-slate-500"}`}>&lt;65</span>
                        <span className={`text-[10px] font-bold block mt-0.5 ${isIntervensi ? "text-[#c92a2a]" : "text-slate-400"}`}>Intervensi DZ</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Risk Heatmap Matrix */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* Left: Heatmap Matrix */}
            <div className="xl:col-span-7 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold font-sans text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 mb-2">
                  RISK HEATMAP MATRIX
                </h3>
                <p className="text-[10px] text-slate-400 font-mono mb-4 leading-relaxed">
                  Pemetaan risiko program berdasarkan Kemungkinan (Probability) &amp; Dampak (Impact).
                </p>
              </div>

              <div className="space-y-1.5">
                {heatmapData.map((row, rIdx) => {
                  const probLabel = 4 - rIdx;
                  return (
                    <div key={rIdx} className="flex gap-1.5 sm:gap-2 items-center">
                      {/* Y-axis label */}
                      <span className="w-5 text-right text-[11px] font-bold text-slate-400 font-mono pr-1 select-none">
                        {probLabel}
                      </span>
                      
                      {/* Row Cells */}
                      <div className="flex-1 grid grid-cols-4 gap-1.5 sm:gap-2">
                        {row.map((val, cIdx) => {
                          const impactLabel = cIdx + 1;
                          const cellScore = probLabel * impactLabel;
                          
                          // High-fidelity styling parameters matching the user's mockup image exactly
                          let bgClass = "";
                          let borderClass = "";
                          let circleBg = "";
                          let coordTextClass = "";

                          if (cellScore === 16) {
                            // Critical (Red)
                            bgClass = "bg-[#e50000]/8";
                            borderClass = "border-[#e50000]/30";
                            circleBg = "bg-[#e50000]";
                            coordTextClass = "text-[#e50000]/70 font-bold";
                          } else if (cellScore === 12) {
                            // High (Orange)
                            bgClass = "bg-[#ff9000]/8";
                            borderClass = "border-[#ff9000]/30";
                            circleBg = "bg-[#ff9000]";
                            coordTextClass = "text-[#ff9000]/75 font-bold";
                          } else if (cellScore === 8 || cellScore === 9) {
                            // Medium (Yellow)
                            bgClass = "bg-[#ffd400]/8";
                            borderClass = "border-[#ffd400]/30";
                            circleBg = "bg-[#ffd400] text-slate-900";
                            coordTextClass = "text-[#c4a200]/80 font-bold";
                          } else if (cellScore === 4 || cellScore === 6) {
                            // Low (Light Green)
                            bgClass = "bg-[#92e58c]/12";
                            borderClass = "border-[#92e58c]/40";
                            circleBg = "bg-[#5ebd47]";
                            coordTextClass = "text-[#5fae59]/90 font-bold";
                          } else {
                            // Very Low (Teal/Cyan 1-3)
                            bgClass = "bg-[#26afb2]/8";
                            borderClass = "border-[#26afb2]/30";
                            circleBg = "bg-[#26afb2]";
                            coordTextClass = "text-[#26afb2]/80 font-bold";
                          }

                          const isSelected = selectedCell?.probability === probLabel && selectedCell?.impact === impactLabel;
                          const borderHighlight = isSelected 
                            ? "ring-2 ring-indigo-600 ring-offset-1 z-10 scale-[1.04] border-indigo-500 shadow-md" 
                            : "shadow-2xs hover:scale-[1.015]";

                          return (
                            <div 
                              key={cIdx} 
                              onClick={() => {
                                setSelectedCell(
                                  selectedCell?.probability === probLabel && selectedCell?.impact === impactLabel
                                    ? null
                                    : { probability: probLabel, impact: impactLabel }
                                );
                              }}
                              className={`h-11 sm:h-13 rounded-lg flex items-center justify-center font-sans border ${bgClass} ${borderClass} ${borderHighlight} relative transition-all duration-150 cursor-pointer active:scale-[0.98]`}
                              title={`Probability: ${probLabel}, Impact: ${impactLabel} (${val} Program)`}
                            >
                              {val > 0 ? (
                                /* Solid beautiful circle badge for non-empty cells exactly like mockup */
                                <div className={`w-7 h-7 sm:w-8.5 sm:h-8.5 rounded-full flex items-center justify-center ${circleBg} text-white font-extrabold text-xs sm:text-sm shadow-md ring-2 ring-white transition-all`}>
                                  {val}
                                </div>
                              ) : (
                                /* Faint coordinates format for empty cells exactly like mockup image */
                                <span className={`text-[9px] sm:text-[10px] font-semibold font-mono tracking-wider ${coordTextClass} select-none`}>
                                  {probLabel},{impactLabel}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                
                {/* X-axis indicators */}
                <div className="flex gap-1.5 sm:gap-2 items-center pt-1.5">
                  <span className="w-5"></span>
                  <div className="flex-1 grid grid-cols-4 gap-1.5 sm:gap-2 text-center font-mono text-[11px] font-bold text-slate-400 select-none">
                    <span>1</span>
                    <span>2</span>
                    <span>3</span>
                    <span>4</span>
                  </div>
                </div>
                
                {/* Under axis label */}
                <div className="flex justify-between items-center px-6 pt-2 text-[9px] font-sans font-bold uppercase tracking-wider text-slate-400 select-none">
                  <span>&larr; DAMPAK RENDAH (IMPACT)</span>
                  <span>DAMPAK TINGGI (IMPACT) &rarr;</span>
                </div>
              </div>
            </div>

            {/* Right: Explanatory & Legends */}
            <div className="xl:col-span-5 flex flex-col justify-between border-t xl:border-t-0 xl:border-l border-slate-100 pt-4 xl:pt-0 xl:pl-6">
              <div>
                <h4 className="text-xs font-bold font-sans text-slate-700 uppercase tracking-wider mb-2">
                  Keterangan Tingkat Risiko &amp; Petunjuk Penggunaan
                </h4>
                <p className="text-[11px] text-slate-500 leading-relaxed mb-4">
                  Matriks di samping memetakan portofolio program berdasarkan parameter tingkat risiko riil (4x4). Klik pada sel mana saja yang berisi angka program untuk memfilter daftar detail program di bawah secara otomatis.
                </p>
                
                {/* Responsive Elegant Legend Table exactly matching the Indonesian specification */}
                <div className="overflow-x-auto border border-slate-200/80 rounded-lg shadow-2xs">
                  <table className="w-full text-left text-[11px] font-sans">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                        <th className="py-2 px-2.5">Risk Level</th>
                        <th className="py-2 px-2 text-center">Skor</th>
                        <th className="py-2 px-2">Warna</th>
                        <th className="py-2 px-2.5">Tindakan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      <tr>
                        <td className="py-2 px-2.5 font-bold text-rose-600">Critical Risk</td>
                        <td className="py-2 px-2 text-center font-bold text-rose-700">16</td>
                        <td className="py-2 px-2">
                          <span className="inline-flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#e50000]" />
                            <span className="text-[10px] text-slate-600 font-medium">Merah</span>
                          </span>
                        </td>
                        <td className="py-2 px-2.5 text-slate-700 font-medium leading-tight">Kondisi Darurat</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-2.5 font-bold text-orange-600">High Risk</td>
                        <td className="py-2 px-2 text-center font-bold text-orange-700">12</td>
                        <td className="py-2 px-2">
                          <span className="inline-flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#ff9000]" />
                            <span className="text-[10px] text-slate-600 font-medium">Oranye</span>
                          </span>
                        </td>
                        <td className="py-2 px-2.5 text-slate-700 font-medium leading-tight">Perhatian Utama</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-2.5 font-bold text-yellow-600">Medium Risk</td>
                        <td className="py-2 px-2 text-center font-bold text-yellow-700">6 - 9</td>
                        <td className="py-2 px-2">
                          <span className="inline-flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#ffd400]" />
                            <span className="text-[10px] text-slate-600 font-medium">Kuning</span>
                          </span>
                        </td>
                        <td className="py-2 px-2.5 text-slate-700 font-medium leading-tight">Pemantauan Rutin</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-2.5 font-bold text-emerald-600">Low Risk</td>
                        <td className="py-2 px-2 text-center font-bold text-emerald-700">1 - 4</td>
                        <td className="py-2 px-2">
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#26afb2]" />
                              <span className="text-[9px] text-slate-500 font-medium">Teal (1-3)</span>
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#92e58c]" />
                              <span className="text-[9px] text-slate-500 font-medium">Hijau Muda (4-6)</span>
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-2.5 text-slate-700 font-medium leading-tight">Risiko Ringan</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3.5 mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[10px] font-sans font-bold text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-[#e50000] rounded-full shadow-2xs"></span> Critical (16)</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-[#ff9000] rounded-full shadow-2xs"></span> High (12)</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-[#ffd400] rounded-full shadow-2xs"></span> Medium (8-9)</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-[#92e58c] rounded-full shadow-2xs"></span> Low - Light Green (4-6)</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-[#26afb2] rounded-full shadow-2xs"></span> Low - Teal (1-3)</span>
              </div>
            </div>
          </div>
        </div>

      </div>



      {/* 5. Details Section Placeholder */}

      {/* 4. Portfolio Status by Cluster Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm overflow-hidden flex flex-col">
        <h3 className="text-xs font-bold font-sans text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 mb-3">
          Portfolio Status By Cluster
        </h3>
        
        {/* Desktop View Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left text-xs font-sans min-w-[850px]">
            <thead>
              <tr className="bg-slate-55 bg-slate-100 font-mono text-slate-600 font-bold border-b border-slate-200">
                <th className="py-3.5 px-4 md:py-4 md:px-5">Cluster</th>
                <th className="py-3.5 px-3 md:py-4 md:px-4 text-center">Total</th>
                <th className="py-3.5 px-3 md:py-4 md:px-4 text-center text-emerald-600">Green</th>
                <th className="py-3.5 px-3 md:py-4 md:px-4 text-center text-amber-600">Yellow</th>
                <th className="py-3.5 px-3 md:py-4 md:px-4 text-center text-rose-600">Red</th>
                <th className="py-3.5 px-3 md:py-4 md:px-4 text-center text-slate-500">Blocked</th>
                <th className="py-3.5 px-5 md:py-4 md:px-6 text-center">Avg Progress</th>
                <th className="py-3.5 px-3 md:py-4 md:px-4 text-center">Critical/High</th>
                <th className="py-3.5 px-3 md:py-4 md:px-4 text-center">DZ Interv.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clusterStats.map((stat, idx) => (
                <tr 
                  key={idx} 
                  onClick={() => handleMetricCardClick(stat.name)}
                  className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                    selectedMetric === stat.name ? "bg-indigo-50/70 font-bold" : ""
                  }`}
                  title={`Klik untuk melihat detail program cluster ${stat.name}`}
                >
                  <td className="py-3.5 px-4 md:py-4 md:px-5 font-medium text-slate-900">{stat.name}</td>
                  <td className="py-3.5 px-3 md:py-4 md:px-4 text-center font-bold text-slate-800">{stat.total}</td>
                  <td className="py-3.5 px-3 md:py-4 md:px-4 text-center font-semibold text-emerald-600">{stat.green}</td>
                  <td className="py-3.5 px-3 md:py-4 md:px-4 text-center font-semibold text-amber-600">{stat.yellow}</td>
                  <td className="py-3.5 px-3 md:py-4 md:px-4 text-center font-semibold text-rose-600">{stat.red}</td>
                  <td className="py-3.5 px-3 md:py-4 md:px-4 text-center font-semibold text-slate-500">{stat.blocked}</td>
                  <td className="py-3.5 px-5 md:py-4 md:px-6 text-center">
                    <div className="flex items-center gap-2">
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div 
                          className="bg-indigo-600 h-2 rounded-full" 
                          style={{ width: `${stat.avgProgress}%` }}
                        />
                      </div>
                      <span className="font-mono text-[11px] font-bold text-slate-700 min-w-[30px]">
                        {stat.avgProgress}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-3 md:py-4 md:px-4 text-center font-bold text-slate-800">{stat.criticalOrHigh}</td>
                  <td className="py-3.5 px-3 md:py-4 md:px-4 text-center font-bold text-indigo-700">{stat.dzIntervention}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-4">
          {clusterStats.map((stat, idx) => {
            const isSelected = selectedMetric === stat.name;
            return (
              <div 
                key={idx} 
                onClick={() => handleMetricCardClick(stat.name)}
                className={`bg-white border rounded-xl p-4 shadow-3xs transition-all duration-200 active:scale-[0.98] cursor-pointer flex flex-col gap-3 ${
                  isSelected 
                    ? "border-indigo-400 ring-2 ring-indigo-100 bg-indigo-50/10" 
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                {/* Header Cluster & Total */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 shrink-0"></span>
                    <h4 className="text-xs font-extrabold text-[#1e266f] leading-snug">
                      {stat.name}
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md shrink-0">
                    {stat.total} Pekerjaan
                  </span>
                </div>

                {/* Avg Progress */}
                <div className="space-y-1 bg-slate-50/50 p-2.5 rounded-lg border border-slate-150">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold text-slate-400 uppercase tracking-wider">Average Progress</span>
                    <span className="font-mono font-black text-[#1e266f]">{stat.avgProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-[#1e266f] h-1.5 rounded-full transition-all duration-500" 
                      style={{ width: `${stat.avgProgress}%` }}
                    />
                  </div>
                </div>

                {/* Status Breakdown Grid */}
                <div className="grid grid-cols-4 gap-1.5">
                  <div className="bg-emerald-50/40 border border-emerald-100 rounded-lg p-1.5 text-center flex flex-col items-center">
                    <span className="text-[8px] font-mono font-bold text-emerald-600 uppercase tracking-wider">Green</span>
                    <span className="text-xs font-bold text-emerald-700 mt-0.5">{stat.green}</span>
                  </div>
                  <div className="bg-amber-50/40 border border-amber-100 rounded-lg p-1.5 text-center flex flex-col items-center">
                    <span className="text-[8px] font-mono font-bold text-amber-600 uppercase tracking-wider">Yellow</span>
                    <span className="text-xs font-bold text-amber-700 mt-0.5">{stat.yellow}</span>
                  </div>
                  <div className="bg-rose-50/40 border border-rose-100 rounded-lg p-1.5 text-center flex flex-col items-center">
                    <span className="text-[8px] font-mono font-bold text-rose-600 uppercase tracking-wider">Red</span>
                    <span className="text-xs font-bold text-rose-700 mt-0.5">{stat.red}</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-150 rounded-lg p-1.5 text-center flex flex-col items-center">
                    <span className="text-[8px] font-mono font-bold text-slate-500 uppercase tracking-wider">Blocked</span>
                    <span className="text-xs font-bold text-slate-600 mt-0.5">{stat.blocked}</span>
                  </div>
                </div>

                {/* Critical/High & DZ Intervention Indicators */}
                <div className="grid grid-cols-2 gap-2 text-[10px] pt-1 border-t border-slate-100">
                  <div className="flex items-center justify-between bg-rose-50/25 border border-rose-100/50 p-2 rounded-lg">
                    <span className="font-semibold text-slate-500">Critical / High:</span>
                    <span className={`font-mono font-black ${stat.criticalOrHigh > 0 ? "text-rose-600" : "text-slate-400"}`}>
                      {stat.criticalOrHigh}
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-indigo-50/25 border border-indigo-100/50 p-2 rounded-lg">
                    <span className="font-semibold text-slate-500">DZ Intervensi:</span>
                    <span className={`font-mono font-black ${stat.dzIntervention > 0 ? "text-indigo-600" : "text-slate-400"}`}>
                      {stat.dzIntervention}
                    </span>
                  </div>
                </div>

                {/* Tap to View Detail */}
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mt-0.5 border-t border-slate-100 pt-2">
                  <span className="text-slate-400">Pilih cluster untuk filter</span>
                  <span className="text-indigo-600 font-bold hover:underline flex items-center gap-0.5">
                    Detail &rarr;
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
