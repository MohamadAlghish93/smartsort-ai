import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { OrganizedFile } from '../types';

interface StatsPanelProps {
  files: OrganizedFile[];
}

const COLORS = ['#8884d8', '#00C49F', '#FFBB28', '#FF8042', '#EF4444', '#A855F7'];

const StatsPanel: React.FC<StatsPanelProps> = ({ files }) => {
  const data = React.useMemo(() => {
    const cats: Record<string, number> = {};
    files.forEach(f => {
      const cat = f.analysis?.suggestedCategory || 'Uncategorized';
      cats[cat] = (cats[cat] || 0) + 1;
    });
    return Object.entries(cats).map(([name, value]) => ({ name, value }));
  }, [files]);

  const sensitiveCount = files.filter(f => f.analysis?.isSensitive).length;

  if (files.length === 0) return null;

  return (
    <div className="bg-gray-800 rounded-xl p-4 shadow-lg border border-gray-700 h-full flex flex-col">
      <h3 className="text-lg font-semibold mb-4 text-gray-200">Distribution</h3>
      <div className="flex-1 min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
                contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
                itemStyle={{ color: '#fff' }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
      
      {sensitiveCount > 0 && (
        <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center justify-between">
          <span className="text-red-400 text-sm font-medium">Sensitive Files Found</span>
          <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">{sensitiveCount}</span>
        </div>
      )}
    </div>
  );
};

export default StatsPanel;