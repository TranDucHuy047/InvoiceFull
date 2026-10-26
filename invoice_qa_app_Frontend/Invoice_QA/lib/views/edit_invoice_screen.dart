import 'package:flutter/material.dart';

import '../ui_contracts/thuy_ui_contracts.dart';

class EditInvoiceScreen extends StatefulWidget {
  const EditInvoiceScreen({
    super.key,
    required this.initialData,
    required this.onSave,
  });

  final InvoiceDetailViewData initialData;
  final SaveInvoiceAction onSave;

  @override
  State<EditInvoiceScreen> createState() => _EditInvoiceScreenState();
}

class _EditInvoiceScreenState extends State<EditInvoiceScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _store;
  late final TextEditingController _address;
  late final TextEditingController _date;
  late final TextEditingController _taxCode;
  late final TextEditingController _tax;
  late final TextEditingController _total;
  late List<_EditableItem> _items;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final data = widget.initialData;
    _store = TextEditingController(text: data.storeName);
    _address = TextEditingController(text: data.address);
    _date = TextEditingController(text: data.dateLabel);
    _taxCode = TextEditingController(text: data.taxCode);
    _tax = TextEditingController(text: data.taxAmount.toStringAsFixed(0));
    _total = TextEditingController(text: data.totalAmount.toStringAsFixed(0));
    _items = data.items
        .map((item) => _EditableItem(name: item.name, quantity: '${item.quantity}', unitPrice: item.unitPrice.toStringAsFixed(0)))
        .toList();
  }

  @override
  void dispose() {
    _store.dispose();
    _address.dispose();
    _date.dispose();
    _taxCode.dispose();
    _tax.dispose();
    _total.dispose();
    for (final item in _items) {
      item.dispose();
    }
    super.dispose();
  }

  void _addItem() {
    setState(() => _items.add(_EditableItem(name: '', quantity: '1', unitPrice: '0')));
  }

  void _removeItem(int index) {
    final removed = _items.removeAt(index);
    removed.dispose();
    setState(() {});
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false) || _saving) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final draft = InvoiceEditDraft(
        invoiceId: widget.initialData.invoiceId,
        storeName: _store.text.trim(),
        address: _address.text.trim(),
        dateLabel: _date.text.trim(),
        taxCode: _taxCode.text.trim(),
        taxAmount: double.tryParse(_tax.text.trim()) ?? 0,
        totalAmount: double.tryParse(_total.text.trim()) ?? 0,
        items: _items
            .map(
              (item) => InvoiceEditItemDraft(
                name: item.name.text.trim(),
                quantity: int.tryParse(item.quantity.text.trim()) ?? 0,
                unitPrice: double.tryParse(item.unitPrice.text.trim()) ?? 0,
              ),
            )
            .toList(),
      );
      await widget.onSave(draft);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Đã lưu thay đổi hóa đơn.')));
      Navigator.of(context).maybePop();
    } catch (error) {
      if (mounted) setState(() => _error = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Chỉnh sửa hóa đơn', style: TextStyle(fontWeight: FontWeight.w900))),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
            children: [
              _field(_store, 'Tên cửa hàng', Icons.storefront_outlined),
              const SizedBox(height: 10),
              _field(_address, 'Địa chỉ', Icons.location_on_outlined),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(child: _field(_date, 'Ngày', Icons.calendar_today_outlined)),
                  const SizedBox(width: 9),
                  Expanded(child: _field(_taxCode, 'Mã số thuế', Icons.badge_outlined, isRequired: false)),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(child: _field(_tax, 'VAT', Icons.percent_rounded, number: true)),
                  const SizedBox(width: 9),
                  Expanded(child: _field(_total, 'Tổng tiền', Icons.payments_outlined, number: true)),
                ],
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  const Expanded(child: Text('Danh sách sản phẩm', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900))),
                  TextButton.icon(onPressed: _addItem, icon: const Icon(Icons.add_rounded), label: const Text('Thêm')),
                ],
              ),
              const SizedBox(height: 8),
              ...List.generate(_items.length, (index) {
                final item = _items[index];
                return Card(
                  margin: const EdgeInsets.only(bottom: 9),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      children: [
                        Row(
                          children: [
                            Expanded(child: Text('Sản phẩm ${index + 1}', style: const TextStyle(fontWeight: FontWeight.w900))),
                            IconButton(onPressed: () => _removeItem(index), icon: const Icon(Icons.delete_outline_rounded, color: Color(0xFFB42318))),
                          ],
                        ),
                        TextFormField(controller: item.name, decoration: const InputDecoration(labelText: 'Tên sản phẩm'), validator: (value) => (value ?? '').trim().isEmpty ? 'Nhập tên sản phẩm.' : null),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(child: TextFormField(controller: item.quantity, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Số lượng'))),
                            const SizedBox(width: 8),
                            Expanded(child: TextFormField(controller: item.unitPrice, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Đơn giá'))),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              }),
              if (_error != null) ...[
                const SizedBox(height: 8),
                Text(_error!, style: const TextStyle(color: Color(0xFFB42318))),
              ],
              const SizedBox(height: 14),
              FilledButton.icon(
                onPressed: _saving ? null : _save,
                icon: _saving ? const SizedBox(width: 17, height: 17, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.save_outlined),
                label: Text(_saving ? 'Đang lưu...' : 'Lưu thay đổi'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _field(TextEditingController controller, String label, IconData icon, {bool isRequired = true, bool number = false}) {
    return TextFormField(
      controller: controller,
      keyboardType: number ? TextInputType.number : TextInputType.text,
      decoration: InputDecoration(labelText: label, prefixIcon: Icon(icon)),
      validator: isRequired ? (value) => (value ?? '').trim().isEmpty ? 'Không được để trống.' : null : null,
    );
  }
}

class _EditableItem {
  _EditableItem({required String name, required String quantity, required String unitPrice})
      : name = TextEditingController(text: name),
        quantity = TextEditingController(text: quantity),
        unitPrice = TextEditingController(text: unitPrice);

  final TextEditingController name;
  final TextEditingController quantity;
  final TextEditingController unitPrice;

  void dispose() {
    name.dispose();
    quantity.dispose();
    unitPrice.dispose();
  }
}
