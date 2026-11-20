'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { formatMoney } from '@/lib/money';
import {
  TrendingUp,
  CreditCard,
  Utensils,
  BarChart3,
  Calendar,
  DollarSign,
  ShoppingBag,
  RefreshCw,
  Award,
  Layers,
  ArrowUpRight,
  Receipt,
  Percent,
} from 'lucide-react';

interface SalesTrendPoint {
  label: string;
  fullDate?: string;
  revenue: number;
  orders: number;
}

interface PaymentBreakdownItem {
  method: string;
  count: number;
  total: number;
  percentage?: number;
}

interface TopProductItem {
  name: string;
  quantity: number;
  revenue: number;
  category: string;
  percentage_of_units?: number;
}

interface PerformanceData {
  total_sales: number;
  total_transactions: number;
  average_order_value: number;
  completion_rate: number;
  total_items_sold: number;
}

export const AdminCharts: React.FC = () => {
  const [range, setRange] = useState<'today' | 'yesterday' | 'this_week' | 'this_month' | 'all_time'>('today');
  const [loading, setLoading] = useState<boolean>(true);
  const [trendMetric, setTrendMetric] = useState<'revenue' | 'orders'>('revenue');
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [hoveredPaymentMethod, setHoveredPaymentMethod] = useState<string | null>(null);

  const [salesTrend, setSalesTrend] = useState<SalesTrendPoint[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState<PaymentBreakdownItem[]>([]);
  const [topProducts, setTopProducts] = useState<TopProductItem[]>([]);
  const [performance, setPerformance] = useState<PerformanceData>({
    total_sales: 0,
    total_transactions: 0,
    average_order_value: 0,
    completion_rate: 100,
    total_items_sold: 0,
  });

  const fetchChartData = async (selectedRange: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/reports?range=${selectedRange}`);
      const data = await res.json();
      if (data.success) {
        setSalesTrend(data.salesTrend || []);
        setPaymentBreakdown(data.paymentBreakdown || []);
        setTopProducts(data.topProducts || []);
        if (data.performance) {
          setPerformance(data.performance);
        } else {
          const totalNet = Number(data.summary?.net_sales || 0);
          const totalOrders = Number(data.summary?.total_orders || 0);
          setPerformance({
            total_sales: totalNet,
            total_transactions: totalOrders,
            average_order_value: totalOrders > 0 ? Math.round(totalNet / totalOrders) : 0,
            completion_rate: 100,
            total_items_sold: (data.topProducts || []).reduce((acc: number, p: any) => acc + (p.quantity || 0), 0),
          });
        }
      }
    } catch (e) {
      console.error('Failed to fetch dashboard chart analytics', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChartData(range);
  }, [range]);

  const rangeButtons = [
    { id: 'today', label: 'Today (آج)' },
    { id: 'yesterday', label: 'Yesterday (کل)' },
    { id: 'this_week', label: 'This Week (7 Days)' },
    { id: 'this_month', label: 'This Month (30 Days)' },
    { id: 'all_time', label: 'All Time (تمام)' },
  ] as const;

  // Chart 1 (Sales Overview): SVG Path calculations
  const chartHeight = 150;
  const chartWidth = 700;
  const paddingX = 45;
  const paddingY = 20;

  const maxVal = useMemo(() => {
    if (salesTrend.length === 0) return 100;
    const values = salesTrend.map((p) => (trendMetric === 'revenue' ? p.revenue : p.orders));
    const highest = Math.max(...values, 0);
    return highest > 0 ? highest * 1.15 : 100;
  }, [salesTrend, trendMetric]);

  const trendPoints = useMemo(() => {
    if (salesTrend.length === 0) return [];
    const usableWidth = chartWidth - paddingX * 2;
    const usableHeight = chartHeight - paddingY * 2;
    const stepX = salesTrend.length > 1 ? usableWidth / (salesTrend.length - 1) : usableWidth;

    return salesTrend.map((p, i) => {
      const val = trendMetric === 'revenue' ? p.revenue : p.orders;
      const x = paddingX + i * stepX;
      const ratio = maxVal > 0 ? val / maxVal : 0;
      const y = chartHeight - paddingY - ratio * usableHeight;
      return { x, y, val, label: p.label, fullDate: p.fullDate, orders: p.orders, revenue: p.revenue };
    });
  }, [salesTrend, trendMetric, maxVal, chartWidth, chartHeight]);

  const svgPathD = useMemo(() => {
    if (trendPoints.length === 0) return '';
    if (trendPoints.length === 1) {
      return `M ${trendPoints[0].x} ${trendPoints[0].y} L ${trendPoints[0].x + 1} ${trendPoints[0].y}`;
    }
    let d = `M ${trendPoints[0].x} ${trendPoints[0].y}`;
    for (let i = 0; i < trendPoints.length - 1; i++) {
      const current = trendPoints[i];
      const next = trendPoints[i + 1];
      const controlX1 = current.x + (next.x - current.x) / 2;
      const controlY1 = current.y;
      const controlX2 = current.x + (next.x - current.x) / 2;
      const controlY2 = next.y;
      d += ` C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${next.x} ${next.y}`;
    }
    return d;
  }, [trendPoints]);

  const svgAreaD = useMemo(() => {
    if (trendPoints.length === 0 || !svgPathD) return '';
    const last = trendPoints[trendPoints.length - 1];
    const first = trendPoints[0];
    const baselineY = chartHeight - paddingY;
    return `${svgPathD} L ${last.x} ${baselineY} L ${first.x} ${baselineY} Z`;
  }, [trendPoints, svgPathD, chartHeight, paddingY]);

  // Payment Colors Mapping
  const getMethodTheme = (methodStr: string) => {
    const m = methodStr.toLowerCase();
    if (m.includes('cash') || m.includes('naqad')) {
      return { color: '#0D9488', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' };
    }
    if (m.includes('jazz')) {
      return { color: '#f59e0b', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' };
    }
    if (m.includes('paisa')) {
      return { color: '#06b6d4', bg: 'bg-cyan-50', text: 'text-cyan-800', border: 'border-cyan-200' };
    }
    return { color: '#6366f1', bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200' };
  };

  // Donut SVG Calculations
  const donutSize = 140;
  const strokeWidth = 22;
  const radius = (donutSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const donutSegments = useMemo(() => {
    const total = paymentBreakdown.reduce((sum, p) => sum + p.total, 0);
    if (total <= 0) return [];
    let accumulatedAngle = 0;

    return paymentBreakdown.map((p) => {
      const fraction = p.total / total;
      const strokeDash = fraction * circumference;
      const offset = circumference - strokeDash;
      const rotation = (accumulatedAngle / total) * 360;
      accumulatedAngle += p.total;

      return {
        ...p,
        fraction,
        strokeDash,
        offset,
        rotation,
        theme: getMethodTheme(p.method),
      };
    });
  }, [paymentBreakdown, circumference]);

  // Top Product relative percentage max
  const maxProductQty = useMemo(() => {
    if (topProducts.length === 0) return 1;
    return Math.max(...topProducts.map((p) => p.quantity), 1);
  }, [topProducts]);

  return (
    <div className="space-y-3">
      {/* Date Filter & Control Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-2.5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg font-bold">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              Business Performance & Sales Analytics
            </h2>
          </div>
        </div>

        {/* Date Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
          {rangeButtons.map((btn) => {
            const isActive = range === btn.id;
            return (
              <button
                key={btn.id}
                type="button"
                onClick={() => setRange(btn.id)}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer font-bold text-xs ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/70'
                }`}
              >
                {btn.label}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => fetchChartData(range)}
            title="Refresh Data"
            className="p-1 rounded-lg text-slate-600 hover:text-indigo-700 hover:bg-slate-200 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Grid: Chart 1 (Sales Overview) & Chart 2 (Sales Performance) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* CHART 1: Sales Overview (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 mb-2.5">
              <div>
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                  <h3 className="font-extrabold text-xs text-slate-900">
                    1. Sales Overview & Revenue Trends
                  </h3>
                </div>
              </div>

              {/* Metric Toggle */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setTrendMetric('revenue')}
                  className={`px-2 py-0.5 rounded transition cursor-pointer ${
                    trendMetric === 'revenue'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Revenue (PKR)
                </button>
                <button
                  type="button"
                  onClick={() => setTrendMetric('orders')}
                  className={`px-2 py-0.5 rounded transition cursor-pointer ${
                    trendMetric === 'orders'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Orders Count
                </button>
              </div>
            </div>

            {/* Quick KPI stats strip */}
            <div className="grid grid-cols-3 gap-2 mb-2 bg-slate-50 p-2 rounded-xl border border-slate-100 text-center">
              <div>
                <span className="text-[9.5px] text-slate-500 font-bold uppercase block">Period Total</span>
                <span className="text-xs font-black text-indigo-700">
                  {formatMoney(performance.total_sales)}
                </span>
              </div>
              <div className="border-x border-slate-200">
                <span className="text-[9.5px] text-slate-500 font-bold uppercase block">Total Orders</span>
                <span className="text-xs font-black text-slate-900">
                  {performance.total_transactions} Bills
                </span>
              </div>
              <div>
                <span className="text-[9.5px] text-slate-500 font-bold uppercase block">Average / Point</span>
                <span className="text-xs font-black text-slate-800">
                  {salesTrend.length > 0
                    ? formatMoney(Math.round(performance.total_sales / salesTrend.length))
                    : 'Rs. 0'}
                </span>
              </div>
            </div>

            {/* Responsive Interactive SVG Area Chart */}
            <div className="relative w-full h-[160px] select-none">
              {salesTrend.length === 0 || performance.total_sales === 0 ? (
                <div className="w-full h-full flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-slate-400 text-xs text-center p-4">
                  <BarChart3 className="w-8 h-8 text-slate-300 mb-2" />
                  <span className="font-bold text-slate-700">No Sales Recorded in This Period</span>
                  <span className="text-[11px] text-slate-500 mt-0.5">
                    Process customer bills at the POS counter to generate live trajectory curves.
                  </span>
                </div>
              ) : (
                <>
                  <svg
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    className="w-full h-full overflow-visible"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id="salesTrendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0D9488" stopOpacity="0.35" />
                        <stop offset="85%" stopColor="#0D9488" stopOpacity="0.03" />
                        <stop offset="100%" stopColor="#0D9488" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal Grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                      const y = chartHeight - paddingY - ratio * (chartHeight - paddingY * 2);
                      const gridVal = Math.round(maxVal * ratio);
                      return (
                        <g key={idx}>
                          <line
                            x1={paddingX}
                            y1={y}
                            x2={chartWidth - paddingX}
                            y2={y}
                            stroke="#e2e8f0"
                            strokeDasharray="4 4"
                            strokeWidth="1"
                          />
                          <text
                            x={paddingX - 6}
                            y={y + 3}
                            textAnchor="end"
                            fontSize="9"
                            fill="#94a3b8"
                            fontWeight="bold"
                          >
                            {trendMetric === 'revenue'
                              ? gridVal >= 1000
                                ? `${Math.round(gridVal / 1000)}k`
                                : gridVal
                              : gridVal}
                          </text>
                        </g>
                      );
                    })}

                    {/* Area fill */}
                    {svgAreaD && <path d={svgAreaD} fill="url(#salesTrendGradient)" />}

                    {/* Main Curve line */}
                    {svgPathD && (
                      <path
                        d={svgPathD}
                        fill="none"
                        stroke="#4F46E5"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {/* Data Points */}
                    {trendPoints.map((pt, idx) => {
                      const isHovered = hoveredPointIndex === idx;
                      return (
                        <g
                          key={idx}
                          onMouseEnter={() => setHoveredPointIndex(idx)}
                          onMouseLeave={() => setHoveredPointIndex(null)}
                          className="cursor-pointer"
                        >
                          {/* Invisible hit target for smooth hovering */}
                          <circle cx={pt.x} cy={pt.y} r="14" fill="transparent" />
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={isHovered ? 5.5 : 3.5}
                            fill="#ffffff"
                            stroke="#4F46E5"
                            strokeWidth={isHovered ? 3 : 2}
                            className="transition-all duration-150"
                          />
                          {/* X-axis labels for selected intervals */}
                          {(idx === 0 ||
                            idx === trendPoints.length - 1 ||
                            idx % Math.ceil(trendPoints.length / 6) === 0) && (
                            <text
                              x={pt.x}
                              y={chartHeight - 6}
                              textAnchor="middle"
                              fontSize="9"
                              fill="#64748b"
                              fontWeight="bold"
                            >
                              {pt.label}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </svg>

                  {/* Interactive Floating Tooltip */}
                  {hoveredPointIndex !== null && trendPoints[hoveredPointIndex] && (
                    <div
                      className="absolute z-20 pointer-events-none transform -translate-x-1/2 -translate-y-full px-3 py-2 bg-slate-900 text-white rounded-xl shadow-xl text-center border border-slate-700 whitespace-nowrap transition-all duration-150"
                      style={{
                        left: `${(trendPoints[hoveredPointIndex].x / chartWidth) * 100}%`,
                        top: `${Math.max(10, (trendPoints[hoveredPointIndex].y / chartHeight) * 100 - 10)}%`,
                      }}
                    >
                      <div className="text-[10px] text-slate-300 font-semibold">
                        {trendPoints[hoveredPointIndex].fullDate || trendPoints[hoveredPointIndex].label}
                      </div>
                      <div className="text-xs font-black text-indigo-400 mt-0.5">
                        {formatMoney(trendPoints[hoveredPointIndex].revenue)}
                      </div>
                      <div className="text-[10px] text-slate-300">
                        {trendPoints[hoveredPointIndex].orders} order(s)
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <span>Periodic Trend</span>
            <span className="text-indigo-700 font-bold">● Active Store Sync</span>
          </div>
        </div>

        {/* CHART 2: Sales Performance Chart (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2.5">
              <div className="flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-indigo-600" />
                <h3 className="font-extrabold text-xs text-slate-900">
                  2. Sales Performance Metrics
                </h3>
              </div>
              <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200">
                AOV & Velocity
              </span>
            </div>

            {/* 3 Metric Cards */}
            <div className="space-y-2">
              {/* Total Sales Amount */}
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block leading-none">
                      Total Sales Amount
                    </span>
                    <span className="text-base font-black text-slate-900 mt-0.5 block leading-tight">
                      {formatMoney(performance.total_sales)}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-200">
                  Net Rupee
                </span>
              </div>

              {/* Total Transactions */}
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block leading-none">
                      Number of Transactions
                    </span>
                    <span className="text-base font-black text-slate-900 mt-0.5 block leading-tight">
                      {performance.total_transactions} Completed Bills
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-200">
                  {performance.total_items_sold} Plates Sold
                </span>
              </div>

              {/* Average Order Value (AOV) */}
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block leading-none">
                      Average Order Value (AOV)
                    </span>
                    <span className="text-base font-black text-amber-800 mt-0.5 block leading-tight">
                      {formatMoney(performance.average_order_value)}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200">
                  Per Customer
                </span>
              </div>
            </div>

            {/* Performance Visual Bars */}
            <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1.5">
              <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                <span>Order Execution Rate</span>
                <span className="text-indigo-700">{performance.completion_rate}% Valid</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, performance.completion_rate))}%` }}
                />
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex justify-between font-medium">
            <span>Average Spending Index</span>
            <span className="font-bold text-slate-700">
              {performance.total_transactions > 0
                ? `${Math.round(performance.total_items_sold / performance.total_transactions)} items / bill`
                : '0 items'}
            </span>
          </div>
        </div>
      </div>

      {/* Grid: Chart 3 (Payment Methods) & Chart 4 (Top Selling Products) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* CHART 3: Payment Methods Chart (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2.5">
              <div className="flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                <h3 className="font-extrabold text-xs text-slate-900">
                  3. Payment Methods Distribution
                </h3>
              </div>
              <span className="text-[9.5px] font-bold text-slate-500 uppercase">
                Tender Mix
              </span>
            </div>

            {/* Donut Chart Visual & Legend */}
            <div className="flex flex-col sm:flex-row items-center gap-4 my-1">
              {/* SVG Donut */}
              <div className="relative w-[140px] h-[140px] shrink-0 flex items-center justify-center">
                {performance.total_sales <= 0 || donutSegments.length === 0 ? (
                  <div className="w-[110px] h-[110px] rounded-full border-4 border-dashed border-slate-200 flex items-center justify-center text-slate-400 text-center text-[9px] font-bold">
                    No Payment
                    <br />
                    Tenders Yet
                  </div>
                ) : (
                  <>
                    <svg width={donutSize} height={donutSize} className="transform -rotate-90">
                      {/* Background circle */}
                      <circle
                        cx={donutSize / 2}
                        cy={donutSize / 2}
                        r={radius}
                        fill="transparent"
                        stroke="#f1f5f9"
                        strokeWidth={strokeWidth}
                      />
                      {/* Slices */}
                      {donutSegments.map((seg, idx) => {
                        const isHovered = hoveredPaymentMethod === seg.method;
                        return (
                          <circle
                            key={idx}
                            cx={donutSize / 2}
                            cy={donutSize / 2}
                            r={radius}
                            fill="transparent"
                            stroke={seg.theme.color}
                            strokeWidth={isHovered ? strokeWidth + 3 : strokeWidth}
                            strokeDasharray={`${seg.strokeDash} ${circumference}`}
                            strokeDashoffset={-((seg.rotation / 360) * circumference)}
                            className="transition-all duration-200 cursor-pointer"
                            onMouseEnter={() => setHoveredPaymentMethod(seg.method)}
                            onMouseLeave={() => setHoveredPaymentMethod(null)}
                          />
                        );
                      })}
                    </svg>

                    {/* Donut Center Display */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                      <span className="text-[9px] text-slate-500 font-bold uppercase block">
                        {hoveredPaymentMethod || 'Total Sales'}
                      </span>
                      <span className="text-xs font-black text-slate-900 block leading-tight">
                        {hoveredPaymentMethod
                          ? formatMoney(
                              paymentBreakdown.find((p) => p.method === hoveredPaymentMethod)?.total || 0
                            )
                          : formatMoney(performance.total_sales)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Breakdown Legend Bars */}
              <div className="flex-1 w-full space-y-1.5">
                {paymentBreakdown.map((p, idx) => {
                  const theme = getMethodTheme(p.method);
                  const isHovered = hoveredPaymentMethod === p.method;
                  return (
                    <div
                      key={idx}
                      onMouseEnter={() => setHoveredPaymentMethod(p.method)}
                      onMouseLeave={() => setHoveredPaymentMethod(null)}
                      className={`p-1.5 rounded-lg border transition cursor-pointer ${
                        isHovered
                          ? `${theme.bg} ${theme.border} shadow-xs scale-[1.01]`
                          : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.color }} />
                          <span className="text-[11px]">{p.method}</span>
                        </div>
                        <span className="font-extrabold text-slate-900 text-[11px]">{formatMoney(p.total)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[9px] text-slate-500 mt-0.5">
                        <span>{p.count} transactions</span>
                        <span className="font-bold text-slate-700">{p.percentage || 0}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex justify-between font-medium">
            <span>Tender Mix</span>
            <span className="font-bold text-indigo-700">Cash & Digital</span>
          </div>
        </div>

        {/* CHART 4: Top Selling Products (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2.5">
              <div className="flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5 text-indigo-600" />
                <h3 className="font-extrabold text-xs text-slate-900">
                  4. Top Selling Products (Menu Rankings)
                </h3>
              </div>
              <span className="text-[9.5px] font-bold text-slate-500 uppercase">
                Volume & Plates Sold
              </span>
            </div>

            {topProducts.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl bg-slate-50 text-slate-400 text-xs text-center p-3">
                <Utensils className="w-6 h-6 text-slate-300 mb-1.5" />
                <span className="font-bold text-slate-700">No Product Sales in Selected Period</span>
                <span className="text-[10px] text-slate-500 mt-0.5">
                  Menu items ordered through the POS counter will be dynamically ranked here.
                </span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {topProducts.slice(0, 6).map((item, idx) => {
                  const percentOfTop = Math.round((item.quantity / maxProductQty) * 100);
                  const isTopItem = idx === 0;
                  return (
                    <div
                      key={idx}
                      className="p-1.5 rounded-lg border border-slate-200 hover:border-indigo-300 bg-slate-50/60 hover:bg-indigo-50/20 transition space-y-1"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-4 h-4 rounded flex items-center justify-center text-[9px] font-black ${
                              isTopItem
                                ? 'bg-amber-400 text-amber-950 shadow-xs'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            #{idx + 1}
                          </span>
                          <span className="font-bold text-slate-900 text-xs">{item.name}</span>
                          <span className="text-[9px] bg-white border border-slate-200 text-slate-600 px-1 py-0.2 rounded font-medium">
                            {item.category}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-600">
                            {item.quantity} Plates
                          </span>
                          <span className="text-xs font-black text-indigo-700 min-w-14 text-right">
                            {formatMoney(item.revenue)}
                          </span>
                        </div>
                      </div>

                      {/* Proportional Volume Bar */}
                      <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isTopItem ? 'bg-indigo-600' : 'bg-indigo-500'
                          }`}
                          style={{ width: `${percentOfTop}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-medium">
            <span>Ranked by plate sales volume and gross revenue</span>
            <span className="font-bold text-slate-700">Top 6 Best Sellers</span>
          </div>
        </div>
      </div>
    </div>
  );
};
