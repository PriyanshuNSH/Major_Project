import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { LineChart as ChartIcon } from 'lucide-react';
import { TrendDataPoint } from '../../types';

interface TrendChartProps {
  data: TrendDataPoint[];
}

export const TrendChart: React.FC<TrendChartProps> = ({ data }) => {
  const validData = Array.isArray(data) ? data.filter((d) => d && typeof d.date === 'string') : [];

  if (validData.length === 0) {
    return (
      <div className="w-full h-64 flex flex-col items-center justify-center rounded-xl bg-slate-50/80 border border-dashed border-slate-200 text-slate-500 p-6 text-center">
        <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 mb-2 shadow-2xs">
          <ChartIcon className="w-5 h-5 text-sky-600" />
        </div>
        <p className="text-sm font-semibold text-slate-800">No Longitudinal Data Recorded</p>
        <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
          Time-series trajectory requires at least two assessments over time. Complete screenings periodically to view your empirical risk trend.
        </p>
      </div>
    );
  }

  if (validData.length === 1) {
    const pt = validData[0];
    return (
      <div className="w-full p-8 bg-slate-50/80 rounded-xl border border-dashed border-slate-200 text-center flex flex-col items-center justify-center">
        <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 mb-2 shadow-2xs">
          <ChartIcon className="w-5 h-5 text-sky-600" />
        </div>
        <p className="text-sm font-semibold text-slate-800">Baseline Assessment Recorded</p>
        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
          Initial record from <strong className="text-slate-700">{pt.date}</strong> shows Diabetes Risk at <strong className="font-mono text-sky-700">{((pt.diabetesScore || 0) * 100).toFixed(1)}%</strong> and Cardiovascular Risk at <strong className="font-mono text-teal-700">{((pt.heartScore || 0) * 100).toFixed(1)}%</strong>. A second screening will activate the longitudinal trend curve.
        </p>
      </div>
    );
  }

  const sanitizedData = validData.map((d) => ({
    ...d,
    diabetesScore: typeof d.diabetesScore === 'number' && Number.isFinite(d.diabetesScore) ? Math.max(0, Math.min(1, d.diabetesScore)) : 0,
    heartScore: typeof d.heartScore === 'number' && Number.isFinite(d.heartScore) ? Math.max(0, Math.min(1, d.heartScore)) : 0,
  }));

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={sanitizedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="diabetesGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0284c7" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="heartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0d9488" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={{ stroke: '#cbd5e1' }} />
          <YAxis
            domain={[0, 1]}
            tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
            tick={{ fill: '#64748b', fontSize: 12 }}
            axisLine={{ stroke: '#cbd5e1' }}
          />
          <Tooltip
            formatter={(value: any, name: any) => [
              `${(Number(value) * 100).toFixed(1)}%`,
              name === 'diabetesScore' ? 'Diabetes Risk' : 'Cardiovascular Risk',
            ]}
            contentStyle={{
              backgroundColor: '#0f172a',
              borderRadius: '8px',
              border: 'none',
              color: '#f8fafc',
              fontSize: '12px',
            }}
          />
          <Legend
            verticalAlign="top"
            height={36}
            formatter={(value) => (value === 'diabetesScore' ? 'Diabetes Risk' : 'Cardiovascular Risk')}
          />
          <Area
            type="monotone"
            dataKey="diabetesScore"
            stroke="#0284c7"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#diabetesGrad)"
          />
          <Area
            type="monotone"
            dataKey="heartScore"
            stroke="#0d9488"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#heartGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
