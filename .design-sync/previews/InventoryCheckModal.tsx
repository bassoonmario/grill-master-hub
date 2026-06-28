import { InventoryCheckModal } from 'bbq-factory-os'

const sampleItem = {
  name: 'Арматура 8мм',
  item_id: '101',
  table_key: 'main',
  system_qty: 150,
}

export const Open = () => (
  <InventoryCheckModal
    item={sampleItem}
    onClose={() => {}}
    onSuccess={() => {}}
  />
)
