import type { StoryDefault } from '@ladle/react';
import { Table, type TableColumn } from './Table.tsx';

export default {
  title: 'Primitives/Table',
} satisfies StoryDefault;

interface Stop {
  name: string;
  arrive: string;
  price: string;
  rating: string;
}

const rows: Stop[] = [
  { name: 'Café Central', arrive: '09:15', price: '€8.50', rating: '4.6' },
  { name: 'City Museum', arrive: '10:40', price: '€12.00', rating: '4.2' },
  { name: 'Riverside Walk', arrive: '12:05', price: '€0.00', rating: '4.8' },
];

const columns: TableColumn<Stop>[] = [
  { id: 'name', header: 'Place', render: (r) => r.name },
  { id: 'arrive', header: 'Arrive', numeric: true, render: (r) => r.arrive },
  { id: 'price', header: 'Price', numeric: true, render: (r) => r.price },
  { id: 'rating', header: 'Rating', numeric: true, render: (r) => r.rating },
];

export const Basic = () => (
  <div className="max-w-lg">
    <Table columns={columns} rows={rows} caption="Today’s stops" />
  </div>
);

export const Zebra = () => (
  <div className="max-w-lg">
    <Table columns={columns} rows={rows} zebra />
  </div>
);
