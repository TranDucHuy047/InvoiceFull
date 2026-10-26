import 'package:flutter/material.dart';

import '../ui_contracts/thuy_ui_contracts.dart';
import '../widgets/stat_card.dart';

class AdminStatisticsScreen extends StatelessWidget {
  const AdminStatisticsScreen({
    super.key,
    this.statistics = const AdminStatisticsViewData(),
    this.invoiceSeries = const [],
    this.ragSeries = const [],
    this.userSeries = const [],
  });

  final AdminStatisticsViewData statistics;
  final List<ChartPointViewData> invoiceSeries;
  final List<ChartPointViewData> ragSeries;
  final List<ChartPointViewData> userSeries;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Thống kê hệ thống', style: TextStyle(fontWeight: FontWeight.w900))),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
          children: [
            Row(
              children: [
                Expanded(child: StatCard(icon: Icons.receipt_long_rounded, title: 'Tổng hóa đơn', value: '${statistics.totalInvoices}')),
                const SizedBox(width: 8),
                Expanded(child: StatCard(icon: Icons.people_alt_outlined, title: 'Tổng User', value: '${statistics.totalUsers}')),
              ],
            ),
            const SizedBox(height: 8),
            StatCard(icon: Icons.auto_awesome_outlined, title: 'Tổng lượt truy vấn RAG', value: '${statistics.totalRagQueries}'),
            const SizedBox(height: 18),
            _SimpleBarChart(title: 'Hóa đơn theo thời gian', series: invoiceSeries, icon: Icons.receipt_long_outlined),
            const SizedBox(height: 12),
            _SimpleBarChart(title: 'Truy vấn AI theo thời gian', series: ragSeries, icon: Icons.auto_awesome_outlined),
            const SizedBox(height: 12),
            _SimpleBarChart(title: 'Người dùng theo thời gian', series: userSeries, icon: Icons.people_outline_rounded),
          ],
        ),
      ),
    );
  }
}

class _SimpleBarChart extends StatelessWidget {
  const _SimpleBarChart({required this.title, required this.series, required this.icon});

  final String title;
  final List<ChartPointViewData> series;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    final data = series.isEmpty
        ? const [
            ChartPointViewData(label: 'T1', value: 4),
            ChartPointViewData(label: 'T2', value: 7),
            ChartPointViewData(label: 'T3', value: 5),
            ChartPointViewData(label: 'T4', value: 9),
          ]
        : series;
    final maxValue = data.fold<double>(1, (max, point) => point.value > max ? point.value : max);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: primary),
                const SizedBox(width: 8),
                Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w900))),
              ],
            ),
            const SizedBox(height: 18),
            SizedBox(
              height: 150,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: data
                    .map(
                      (point) => Expanded(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 4),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              Text(point.value.toStringAsFixed(0), style: const TextStyle(fontSize: 10, color: Color(0xFF687386))),
                              const SizedBox(height: 4),
                              Container(
                                height: 100.0 * (point.value / maxValue).clamp(0.06, 1.0),
                                decoration: BoxDecoration(color: primary.withValues(alpha: 0.78), borderRadius: BorderRadius.circular(8)),
                              ),
                              const SizedBox(height: 5),
                              Text(point.label, style: const TextStyle(fontSize: 10)),
                            ],
                          ),
                        ),
                      ),
                    )
                    .toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
