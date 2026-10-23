import React, { useEffect, useState } from "react";
import { Plus, X, Upload, Loader2Icon } from "lucide-react";
import Button from "../ui/Button";
import SearchableSelect from "../ui/SearchableSelect";
import toast from "react-hot-toast";
import { notifyPendingCountsChanged } from "../../utils/pendingCountEvents";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../services/supabaseClient";
import { uploadFileToSupabase } from "../../services/storageService";
import { fetchMasterDataFromSupabase, addMasterItem } from "../../services/masterService";

const IndentForm = ({ onSubmit, onCancel, taskList }) => {
  const { user } = useAuth();
  const [sheetData, setSheetData] = useState([]);
  const [doerName, setDoerName] = useState([]);
  const [giveByData, setGivenByData] = useState([]);
  const [taskStatusData, setTaskStatusData] = useState([]);
  const [priorityData, setPriorityData] = useState([]);
  const [departmentData, setDepartmentData] = useState([]);
  const [uomData, setUomData] = useState([]);
  const [firmNameData, setFirmNameData] = useState([]);
  const [machineNameMasterData, setMachineNameMasterData] = useState([]);

  const [selectedMachine, setSelectedMachine] = useState("");
  const [filteredSerials, setFilteredSerials] = useState([]);
  const [filteredDepartment, setFilteredDepartment] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [machineLocation, setMachineLocation] = useState([]);
  const [location, setLocation] = useState("");
  const [userManualFile, setUserManualFile] = useState(null);
  const [machinePartName, setMachinePartName] = useState("");

  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTaskDate, setEndTaskDate] = useState("");
  const [availableFrequencies, setAvailableFrequencies] = useState([]);

  const [selectedSerialNo, setSelectedSerialNo] = useState("");
  
  const userFirms =
    user?.firmName && user.firmName.toLowerCase() !== "all"
      ? user.firmName.split(",").map((f) => f.trim()).filter(Boolean)
      : ["Pmmpl", "Purab", "Rkl", "Refrasynth", "Refratech"];

  const [selectedFirmName, setSelectedFirmName] = useState(() => userFirms[0] || "Pmmpl");

  useEffect(() => {
    if (userFirms.length > 0 && !userFirms.includes(selectedFirmName)) {
      setSelectedFirmName(userFirms[0]);
    }
  }, [user?.firmName]);
  const [selectedGivenBy, setSelectedGivenBy] = useState("");
  const [selectedDoerName, setSelectedDoerName] = useState("");
  const [selectedTaskType, setSelectedTaskType] = useState("Select Task Type");
  const [needSoundTask, setNeedSoundTask] = useState("");
  const [temperature, setTemperature] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("");
  const [description, setPromblemInMachine] = useState("");
  const [machineArea, setMachineArea] = useState("");
  const [partName, setPartName] = useState("");
  const [uom, setUom] = useState("");
  const [quantity, setQuantity] = useState("");

  // "Add New" toggles for dropdowns that should also accept a custom typed value
  const [isAddingMachine, setIsAddingMachine] = useState(false);
  const [isAddingSerial, setIsAddingSerial] = useState(false);
  const [isAddingDoer, setIsAddingDoer] = useState(false);
  const [isAddingGivenBy, setIsAddingGivenBy] = useState(false);
  const [isAddingDepartment, setIsAddingDepartment] = useState(false);
  const [isAddingPriority, setIsAddingPriority] = useState(false);
  const [isAddingUom, setIsAddingUom] = useState(false);
  const [isAddingFirmName, setIsAddingFirmName] = useState(false);

  const [loaderSheetData, setLoaderSheetData] = useState(false);
  const [loaderSubmit, setLoaderSubmit] = useState(false);
  const [loaderMasterSheetData, setLoaderMasterSheetData] = useState(false);

  const [enableReminder, setEnableReminder] = useState(false);
  const [requireAttachment, setRequireAttachment] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);

  // Updated URLs and IDs for data fetching (Maintenance)
  const DATA_FETCH_SCRIPT_URL = import.meta.env.VITE_DATA_FETCH_SCRIPT_URL;
  const DATA_SHEET_ID = import.meta.env.VITE_DATA_SHEET_ID;

  // URLs and IDs for data submission(Repair System)
  const SUBMIT_SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL;
  const SUBMIT_SHEET_ID = import.meta.env.VITE_SHEET_ID;
  const FOLDER_ID = import.meta.env.VITE_FOLDER_ID;

  const fetchSheetData = async () => {
    try {
      setLoaderSheetData(true);
      const { data, error } = await supabase
        .from("indent")
        .select("task_no");

      if (data && !error) {
        setSheetData(data.map((d) => ({ "Task No": d.task_no, taskNo: d.task_no })));
      }
    } catch (err) {
      console.warn("fetchSheetData Supabase error:", err);
    } finally {
      setLoaderSheetData(false);
    }
  };

  const fetchMasterSheetData = async () => {
    try {
      setLoaderMasterSheetData(true);
      const sortAlpha = (list = []) =>
        [...list].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }));

      const mData = await fetchMasterDataFromSupabase();

      setDoerName(sortAlpha(mData.indentor_name || []));
      setGivenByData(sortAlpha(mData.authorized_name || []));
      setMachineNameMasterData(sortAlpha(mData.machine_name || []));
      setDepartmentData(sortAlpha(mData.department || []));
      setUomData(sortAlpha(mData.uom || []));
      setFirmNameData(sortAlpha(mData.firm_name || ["Pmmpl", "Purab", "Refrasynth", "Rkl", "Refratech"]));
      setPriorityData(["Critical", "High", "Medium", "Low"]);
      setTaskStatusData(["Pending", "Complete"]);
    } catch (err) {
      console.error("Master data load error:", err);
    } finally {
      setLoaderMasterSheetData(false);
    }
  };

  useEffect(() => {
    if (taskList && taskList.length > 0) {
      setSheetData(taskList);
    }
    fetchSheetData();
    fetchMasterSheetData();
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffInDays = (end - start) / (1000 * 60 * 60 * 24);

      let frequencies = [];
      if (diffInDays >= 365) {
        frequencies = [
          "one-time",
          "Daily",
          "Weekly",
          "Monthly",
          "Quarterly",
          "Half Yearly",
          "Yearly",
        ];
      } else if (diffInDays >= 180) {
        frequencies = [
          "one-time",
          "Daily",
          "Weekly",
          "Monthly",
          "Quarterly",
          "Half Yearly",
        ];
      } else if (diffInDays >= 90) {
        frequencies = ["one-time", "Daily", "Weekly", "Monthly", "Quarterly"];
      } else if (diffInDays >= 30) {
        frequencies = ["one-time", "Daily", "Weekly", "Monthly"];
      } else if (diffInDays >= 7) {
        frequencies = ["one-time", "Daily", "Weekly"];
      } else if (diffInDays > 0) {
        frequencies = ["one-time", "Daily"];
      }

      setAvailableFrequencies(frequencies);
    } else {
      setAvailableFrequencies([]);
    }
  }, [startDate, endDate]);

  const uploadFile = async (file, prefix = "indent_doc") => {
    if (!file) return "";
    try {
      const url = await uploadFileToSupabase(file, prefix);
      return url;
    } catch (err) {
      console.error("Supabase Storage error:", err);
      toast.error(err.message || "❌ File upload failed");
      return "";
    }
  };

  const clearFormState = () => {
    setSelectedSerialNo("");
    setSelectedMachine("");
    setSelectedFirmName(userFirms[0] || "Pmmpl");
    setSelectedGivenBy("");
    setSelectedDoerName("");
    setSelectedTaskType("Select Task Type");
    setStartDate("");
    setEndDate("");
    setEndTaskDate("");
    setStartTime("");
    setEndTime("");
    setPromblemInMachine("");
    setSelectedPriority("");
    setMachinePartName("");
    setLocation("");
    setMachineArea("");
    setPartName("");
    setUom("");
    setQuantity("");
    setNeedSoundTask("");
    setTemperature("");
    setEnableReminder(false);
    setRequireAttachment(false);
    setUserManualFile(null);
    setFilteredSerials([]);
    setSelectedDepartment("");
    setIsAddingMachine(false);
    setIsAddingSerial(false);
    setIsAddingDoer(false);
    setIsAddingGivenBy(false);
    setIsAddingDepartment(false);
    setIsAddingPriority(false);
    setIsAddingUom(false);
    setIsAddingFirmName(false);
  };

  const handleMachineSelect = (selected) => {
    setSelectedMachine(selected);

    if (!selected) {
      setFilteredSerials([]);
      setSelectedSerialNo("");
      return;
    }

    const allSourceTasks = [...sheetData, ...(taskList || [])];
    const matched = allSourceTasks
      .filter((item) => (item["Machine Name"] || item.machineName) === selected)
      .map((item) => item["Serial No"] || item.serialNo)
      .filter(Boolean);

    let serials = [...new Set(matched)].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base", numeric: true })
    );

    if (serials.length === 0 && selected) {
      const parts = selected.split("/");
      if (parts.length > 1) {
        const lastPart = parts[parts.length - 1].trim();
        if (lastPart) {
          serials.push(lastPart);
        }
      }
      serials.push(selected);
      serials = [...new Set(serials)].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base", numeric: true })
      );
    }

    setFilteredSerials(serials);
    if (serials.length === 1) {
      setSelectedSerialNo(serials[0]);
      handleSerialSelect(serials[0]);
    } else {
      setSelectedSerialNo("");
    }
  };

  const handleAddNewMachine = () => {
    setIsAddingMachine(true);
    setSelectedMachine("");
    setFilteredSerials([]);
    setIsAddingSerial(false);
    setSelectedSerialNo("");
  };

  const handleChooseMachineFromList = () => {
    setIsAddingMachine(false);
    setSelectedMachine("");
    setFilteredSerials([]);
    setIsAddingSerial(false);
    setSelectedSerialNo("");
  };

  const handleSerialSelect = (val) => {
    setSelectedSerialNo(val);
    if (!val) return;

    const allSourceTasks = [...sheetData, ...(taskList || [])];
    const found = allSourceTasks.find(
      (item) => (item["Serial No"] || item.serialNo) === val
    );
    if (found) {
      if (found["Department"] || found.department) {
        setSelectedDepartment(found["Department"] || found.department);
      }
      if (found["Location"] || found.location) {
        setLocation(found["Location"] || found.location);
      }
    }
  };

  const handleAddNewSerial = () => {
    setIsAddingSerial(true);
    setSelectedSerialNo("");
  };

  const handleChooseSerialFromList = () => {
    setIsAddingSerial(false);
    setSelectedSerialNo("");
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();

    // Basic validation
    if (!selectedMachine || !selectedSerialNo || !selectedDoerName || !selectedGivenBy || !selectedFirmName) {
      toast.error("❌ Please fill in all required fields");
      return;
    }

    try {
      setLoaderSubmit(true);

      // Upload file first if exists
      let userManualUrl = "";
      if (userManualFile) {
        userManualUrl = await uploadFile(userManualFile, "machine_manual");
      }

      const formPayload = new FormData();
      formPayload.append("sheetName", "Repair System");

      // For Repair tasks, send as single insert
      formPayload.append("action", "insert1");

      // Prepare single task data without generating task number
      const taskData = {
        "Time Stemp": new Date().toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
        }),
        "Serial No": selectedSerialNo,
        "Machine Name": selectedMachine,
        "Firm Name": selectedFirmName,
        "Given By": selectedGivenBy,
        "Authorized Name": selectedGivenBy,
        "Authorized By": selectedGivenBy,
        "Doer Name": selectedDoerName,
        "Doer's Name": selectedDoerName,
        "Indentor Name": selectedDoerName,
        "Indentor's Name": selectedDoerName,
        "Enable Reminders": enableReminder ? "Yes" : "No",
        "Require Attachment": requireAttachment ? "Yes" : "No",
        "Task Start Date": startDate ? (startTime ? `${startDate} ${startTime}:00` : `${startDate} 00:00:00`) : "",
        "Task Ending Date": endTaskDate ? (endTime ? `${endTaskDate} ${endTime}:00` : `${endTaskDate} 00:00:00`) : "",
        "Problem With Machine": description,
        Department: selectedDepartment,
        Location: location,
        "Machine Part Name": machinePartName,
        "Image Link": userManualUrl || "link not available",
        "Machine Image": userManualUrl || "link not available",
        "Image of the Machine": userManualUrl || "link not available",
        Priority: selectedPriority,
        UOM: uom,
        Quantity: quantity,
      };

      // Calculate the assigned task number
      const maxTaskNum = Math.max(
        ...(sheetData || []).concat(taskList || []).map((t) => {
          const m = (t.taskNo || t["Task No"] || "").match(/TR-(\d+)/i);
          return m ? parseInt(m[1], 10) : 0;
        }),
        0
      );
      const assignedTaskNo = `TR-${String(maxTaskNum + 1).padStart(3, "0")}`;

      // Save directly to Supabase indent table
      const { error: supaErr } = await supabase
        .from("indent")
        .upsert(
          {
            task_no: assignedTaskNo,
            firm_name: selectedFirmName || "All",
            machine_name: selectedMachine,
            serial_no: selectedSerialNo,
            department: selectedDepartment || null,
            location: location || null,
            machine_part_name: machinePartName || null,
            priority: selectedPriority || "Medium",
            uom: uom || null,
            quantity: parseFloat(quantity) || 1,
            problem_description: description || null,
            given_by: selectedGivenBy || null,
            indentor_name: selectedDoerName || null,
            enable_reminders: enableReminder,
            machine_image_url: userManualUrl || null,
          },
          { onConflict: "task_no" }
        );

      if (supaErr) {
        console.error("Supabase indent insert error:", supaErr);
        toast.error("❌ Failed to save task: " + supaErr.message);
        return;
      }

      toast.success(`✅ Task ${assignedTaskNo} assigned successfully!`);
      notifyPendingCountsChanged();

      // If user added a NEW machine name, append to dropdown and persist to Supabase Master
      if (isAddingMachine && selectedMachine) {
        const cleanName = selectedMachine.trim();
        setMachineNameMasterData((prev) => [...prev, cleanName]);
        addMasterItem("machine_name", cleanName).catch((err) =>
          console.warn("Failed to persist new machine to master table:", err)
        );
      }

      // Clear form state
      clearFormState();

      // Call onSubmit to refresh the parent component's data
      if (onSubmit) {
        onSubmit();
      }

      // Close modal
      onCancel();

    } catch (error) {
      console.error("❌ Submission failed:", error);
      toast.error("❌ Something went wrong during submission.");
    } finally {
      setLoaderSubmit(false);
    }
  };

  return (
    <form onSubmit={handleSubmitForm} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Firm Name Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Firm Name *
          </label>
          <select
            value={selectedFirmName}
            onChange={(e) => setSelectedFirmName(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white font-medium"
          >
            {userFirms.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        {/* Machine Name Dropdown */}
        <SearchableSelect
          id="machineName"
          label="Machine Name *"
          required
          value={selectedMachine}
          onChange={setSelectedMachine}
          onOptionSelect={handleMachineSelect}
          options={machineNameMasterData}
          loading={loaderMasterSheetData}
          isAdding={isAddingMachine}
          setIsAdding={setIsAddingMachine}
          onAddNew={handleAddNewMachine}
          onChooseFromList={handleChooseMachineFromList}
        />

        {/* Firm Name */}
        {user?.firmName && user.firmName.toLowerCase() !== "all" ? (
          <div>
            <label htmlFor="firmName" className="block text-sm font-medium text-gray-700 mb-1">
              Firm Name *
            </label>
            <input
              type="text"
              id="firmName"
              value={selectedFirmName}
              readOnly
              className="py-2 w-full rounded-md border border-gray-300 shadow-sm px-4 bg-gray-100 cursor-not-allowed focus:outline-none text-sm"
            />
          </div>
        ) : (
          <SearchableSelect
            id="firmName"
            label="Firm Name *"
            required
            value={selectedFirmName}
            onChange={setSelectedFirmName}
            options={firmNameData}
            loading={loaderMasterSheetData}
            isAdding={isAddingFirmName}
            setIsAdding={setIsAddingFirmName}
          />
        )}

        {/* Serial No Related to Machine Name */}
        {(selectedMachine || isAddingMachine) && !loaderSheetData && (
          <SearchableSelect
            id="serialNo"
            label="Serial Number *"
            required
            value={selectedSerialNo}
            onChange={setSelectedSerialNo}
            onOptionSelect={handleSerialSelect}
            options={filteredSerials}
            isAdding={isAddingMachine || isAddingSerial}
            setIsAdding={setIsAddingSerial}
            disableChooseFromList={isAddingMachine}
            onAddNew={handleAddNewSerial}
            onChooseFromList={handleChooseSerialFromList}
            autoFocusOnAdd={!isAddingMachine}
          />
        )}

        {/* Indentor Name */}
        <SearchableSelect
          id="doerName"
          label="Indentor Name *"
          required
          value={selectedDoerName}
          onChange={setSelectedDoerName}
          options={doerName}
          loading={loaderMasterSheetData}
          isAdding={isAddingDoer}
          setIsAdding={setIsAddingDoer}
        />

        {/* Authorized Name */}
        <SearchableSelect
          id="givenBy"
          label="Authorized Name *"
          required
          value={selectedGivenBy}
          onChange={setSelectedGivenBy}
          options={giveByData}
          loading={loaderMasterSheetData}
          isAdding={isAddingGivenBy}
          setIsAdding={setIsAddingGivenBy}
        />

        {/* Department */}
        <SearchableSelect
          id="department"
          label="Department"
          value={selectedDepartment}
          onChange={setSelectedDepartment}
          options={departmentData}
          loading={loaderMasterSheetData}
          isAdding={isAddingDepartment}
          setIsAdding={setIsAddingDepartment}
        />

        {/* Machine Part Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Machine Part Name
          </label>
          <input
            type="text"
            name="machinePartName"
            value={machinePartName}
            onChange={(e) => setMachinePartName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
          />
        </div>

        {/* UOM */}
        <SearchableSelect
          id="uom"
          label="UOM"
          value={uom}
          onChange={setUom}
          options={uomData}
          loading={loaderMasterSheetData}
          isAdding={isAddingUom}
          setIsAdding={setIsAddingUom}
        />

        {/* Quantity */}
        <div>
          <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-2">
            Quantity
          </label>
          <input
            type="number"
            id="quantity"
            name="quantity"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Enter Quantity"
            min="0"
            step="any"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
          />
        </div>

        {/* Priority */}
        <SearchableSelect
          id="priority"
          label="Priority"
          value={selectedPriority}
          onChange={setSelectedPriority}
          options={priorityData.length > 0 ? priorityData : ["Critical", "High", "Low", "Medium"]}
          loading={loaderMasterSheetData}
          isAdding={isAddingPriority}
          setIsAdding={setIsAddingPriority}
        />

        {/* Start Date */}
        <div>
          <label
            htmlFor="startDate"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Task Start Date
          </label>
          <input
            type="date"
            id="startDate"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-md border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm p-2 bg-white"
          />
        </div>

        {/* Task Start Time */}
        <div>
          <label
            htmlFor="startTime"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Task Start Time
          </label>
          <input
            type="time"
            id="startTime"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full rounded-md border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm p-2 bg-white"
          />
        </div>

        {/* End Date */}
        <div>
          <label
            htmlFor="endTaskDate"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Task End Date
          </label>
          <input
            type="date"
            id="endTaskDate"
            value={endTaskDate}
            onChange={(e) => setEndTaskDate(e.target.value)}
            className="w-full rounded-md border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm p-2 bg-white"
          />
        </div>

        {/* Task End Time */}
        <div>
          <label
            htmlFor="endTime"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Task End Time
          </label>
          <input
            type="time"
            id="endTime"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full rounded-md border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm p-2 bg-white"
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Problem With Machine
        </label>
        <textarea
          id="description"
          onChange={(e) => setPromblemInMachine(e.target.value)}
          value={description}
          rows={4}
          className="w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          placeholder="Enter Machine Problem..."
        />
      </div>

      {/* Location */}
      <div>
        <label
          htmlFor="location"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Location
        </label>
        <input
          type="text"
          id="location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Enter location"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
        />
      </div>

      {/* upload Image */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Image of the Machine
        </label>
        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-blue-400 transition-colors duration-200 bg-white">
          <div className="space-y-1 text-center">
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <div className="flex text-sm text-gray-600">
              <label className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500">
                <span>Upload a file</span>
                <input
                  type="file"
                  name="imageOfTheMachine"
                  onChange={(e) => setUserManualFile(e.target.files[0])}
                  className="sr-only"
                  accept="image/*"
                />
              </label>
              <p className="pl-1">or drag and drop</p>
            </div>
            <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
            {userManualFile && (
              <p className="text-sm text-green-600 mt-2">
                Selected: {userManualFile.name}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-6">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            name="enableReminders"
            checked={enableReminder}
            onChange={() => setEnableReminder((prev) => !prev)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <span className="ml-2 text-sm text-gray-700">Enable Reminders</span>
        </label>

        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            name="requireAttachment"
            checked={requireAttachment}
            onChange={() => setRequireAttachment((prev) => !prev)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <span className="ml-2 text-sm text-gray-700">Require Attachment</span>
        </label>
      </div>

      <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={loaderSubmit}>
          {loaderSubmit && <Loader2Icon className="animate-spin mr-2" />}
          Save Indent
        </Button>
      </div>
    </form>
  );
};

export default IndentForm;
