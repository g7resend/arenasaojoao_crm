export type PaymentMethod = 'pix' | 'dinheiro' | 'cartao'
export type StudentStatus = 'ativo' | 'inativo'
export type PaymentStatus = 'pendente' | 'pago'
export type ComputedPaymentStatus = 'pendente' | 'pago' | 'atrasado'
export type LessonStatus = 'agendada' | 'realizada' | 'cancelada'

export interface Settings {
  id: number
  arena_name: string
  pix_key: string
  group_link: string
  tpl_billing: string
  tpl_lesson_confirmation: string
  tpl_schedule: string
  updated_at: string
}

export interface Plan {
  id: string
  name: string
  monthly_price: number
  classes_per_week: number
  active: boolean
  created_at: string
}

export interface ClassSlot {
  id: string
  weekday: number
  start_time: string
  end_time: string | null
  name: string
  teacher: string
  active: boolean
  created_at: string
}

export interface Student {
  id: string
  name: string
  phone: string | null
  plan_id: string | null
  payment_method: PaymentMethod
  due_day: number
  status: StudentStatus
  notes: string
  created_at: string
}

export interface Payment {
  id: string
  student_id: string
  competence: string
  amount: number
  due_date: string
  status: PaymentStatus
  paid_at: string | null
  payment_method: PaymentMethod | null
  created_at: string
}

export interface PaymentView extends Payment {
  computed_status: ComputedPaymentStatus
  student_name: string
  student_phone: string | null
}

export interface PrivateLesson {
  id: string
  student_id: string | null
  guest_name: string | null
  guest_phone: string | null
  lesson_date: string
  start_time: string
  price: number
  status: LessonStatus
  paid: boolean
  payment_method: PaymentMethod | null
  notes: string
  created_at: string
}

export interface CourtBooking {
  id: string
  responsible_name: string
  phone: string | null
  booking_date: string
  start_time: string
  end_time: string
  price: number
  paid: boolean
  payment_method: PaymentMethod | null
  notes: string
  created_at: string
}

export interface ArenaEvent {
  id: string
  name: string
  event_date: string
  start_time: string | null
  location: string
  capacity: number | null
  notes: string
  created_at: string
}

export interface EventLot {
  id: string
  event_id: string
  name: string
  price: number
  sort_order: number
}

export interface EventParticipant {
  id: string
  event_id: string
  lot_id: string | null
  name: string
  phone: string | null
  payment_method: PaymentMethod
  amount_paid: number
  paid_at: string
  checked_in: boolean
  checked_in_at: string | null
  created_at: string
}
