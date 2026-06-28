import { ReplenishModal } from 'bbq-factory-os'

const coalItem = {
  id: '42',
  name: 'Деревне вугілля',
  unit_type: 'kg',
  conversion_factor: 1,
  is_internal: false,
}

const rollItem = {
  id: '7',
  name: 'Дріт зварювальний',
  unit_type: 'roll',
  conversion_factor: 50,
  is_internal: false,
}

// transform: scale(1) creates a new stacking context so fixed children
// are positioned relative to this wrapper, not the viewport
const Contain = ({ children }: { children: React.ReactNode }) => (
  <div style={{ position: 'relative', height: 500, overflow: 'hidden', transform: 'scale(1)' }}>
    {children}
  </div>
)

export const Simple = () => (
  <Contain>
    <ReplenishModal item={coalItem} onClose={() => {}} onSuccess={() => {}} />
  </Contain>
)

export const WithWarehouseSelect = () => (
  <Contain>
    <ReplenishModal item={rollItem} onClose={() => {}} onSuccess={() => {}} showWarehouseSelect />
  </Contain>
)
