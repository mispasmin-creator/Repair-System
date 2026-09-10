// store/dataStore.js
import {create} from 'zustand';

const useDataStore = create((set) => ({
  repairTasks: [],
  pendingRepairTasks: [],
  historyRepairTasks: [],
  repairPayments: [],
  pendingRepairPayments: [],
  historyRepairPayments: [],
  vendors: [],
  transporters: [],
  paymentTypes: [],
  setVendors: (vendors) => set({ vendors }),
  setTransporters: (transporters) => set({ transporters }),
  setPaymentTypes: (paymentTypes) => set({ paymentTypes }),
  setRepairTasks: (tasks) => set({ repairTasks: tasks }),
  setPendingRepairTasks: (tasks) => set({ pendingRepairTasks: tasks }),
  setHistoryRepairTasks: (tasks) => set({ historyRepairTasks: tasks }),
  updateRepairTask: (taskNo, updatedData) => set((state) => ({
    repairTasks: state.repairTasks.map(task => 
      task.taskNo === taskNo ? { ...task, ...updatedData } : task
    ),
    pendingRepairTasks: state.pendingRepairTasks.filter(task => task.taskNo !== taskNo),
    historyRepairTasks: [...state.historyRepairTasks, { 
      ...state.repairTasks.find(task => task.taskNo === taskNo), 
      ...updatedData 
    }]
  })),
    setRepairPayments: (payments) => set({ repairPayments: payments }),
  setPendingRepairPayments: (payments) => set({ pendingRepairPayments: payments }),
  setHistoryRepairPayments: (payments) => set({ historyRepairPayments: payments }),
  addRepairPayment: (payment) => 
    set((state) => ({ 
      repairPayments: [...state.repairPayments, payment],
      historyRepairPayments: [...state.historyRepairPayments, payment]
    })),

}));

export default useDataStore;