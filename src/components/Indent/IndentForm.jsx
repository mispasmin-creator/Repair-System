import React, { useEffect, useState } from "react";
import { Plus, X, Upload, Loader2Icon } from "lucide-react";
import Button from "../ui/Button";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";

// Dropdown that lets the user pick an existing value or type a brand new one
// (the typed value is only used for this submission, it is not saved back to the Master sheet)
const AddNewSelect = ({ id, label, required, value, onChange, options, loading, isAdding, setIsAdding }) => {
  const plainLabel = label.replace(/\*/g, "").trim();

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      {isAdding ? (
        <div className="flex gap-2">
          <input
            type="text"
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Enter new ${plainLabel}`}
            required={required}
            autoFocus
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="button"
            onClick={() => {
              setIsAdding(false);
              onChange("");
            }}
            className="text-sm text-blue-600 hover:text-blue-700 whitespace-nowrap"
          >
            Choose from list
          </button>
        </div>
      ) : (
        <select
          id={id}
          value={value}
          onChange={(e) => {
            if (e.target.value === "__add_new__") {
              setIsAdding(true);
              onChange("");
            } else {
              onChange(e.target.value);
            }
          }}
          className="py-2 w-full rounded-md border border-gray-300 shadow-sm px-4 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required={required}
        >
          <option value="">Select {plainLabel}</option>
          {loading ? (
            <option disabled>Wait Please...</option>
          ) : (
            [...new Set(options)].filter(Boolean).map((item, index) => (
              <option key={index} value={item}>
                {item}
              </option>
            ))
          )}
          <option value="__add_new__">+ Add New</option>
        </select>
      )}
    </div>
  );
};

const IndentForm = ({ onSubmit, onCancel, taskList }) => {
  const { user } = useAuth();
  const [sheetData, setSheetData] = useState([]);
  const [doerName, setDoerName] = useState([]);
  const [giveByData, setGivenByData] = useState([]);
  const [taskStatusData, setTaskStatusData] = useState([]);
  const [priorityData, setPriorityData] = useState([]);
  const [departmentData, setDepartmentData] = useState([]);

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
  const [selectedFirmName, setSelectedFirmName] = useState("");

  useEffect(() => {
    if (user?.firmName && user.firmName.toLowerCase() !== "all") {
      setSelectedFirmName(user.firmName);
    }
  }, [user]);
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
    if (!DATA_FETCH_SCRIPT_URL || !DATA_SHEET_ID) return;
    const SHEET_NAME = "FormResponses";
    try {
      setLoaderSheetData(true);
      const res = await fetch(
        `${DATA_FETCH_SCRIPT_URL}?sheetId=${DATA_SHEET_ID}&sheet=${SHEET_NAME}`
      );
      const result = await res.json();

      if (result.success && result.table) {
        const headers = result.table.cols.map((col) => col.label);
        const rows = result.table.rows;

        const formattedRows = rows.map((rowObj) => {
          const row = rowObj.c;
          const rowData = {};
          row.forEach((cell, i) => {
            rowData[headers[i]] = cell.v;
          });
          return rowData;
        });

        setSheetData(formattedRows);
      } else {
        console.error("Server error:", result.message || result.error);
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoaderSheetData(false);
    }
  };

  const fetchMasterSheetData = async () => {
    if (!DATA_FETCH_SCRIPT_URL || !DATA_SHEET_ID) return;
    const SHEET_NAME = "Master";
    try {
      setLoaderMasterSheetData(true);
      const res = await fetch(
        `${DATA_FETCH_SCRIPT_URL}?sheetId=${DATA_SHEET_ID}&sheet=${SHEET_NAME}`
      );
      const result = await res.json();

      if (result.success && result.table) {
        const headers = result.table.cols.map((col) => col.label);
        const rows = result.table.rows;

        const formattedRows = rows.map((rowObj) => {
          const row = rowObj.c;
          const rowData = {};
          row.forEach((cell, i) => {
            rowData[headers[i]] = cell.v;
          });
          return rowData;
        });

        const DoerNameData = formattedRows.map((item) => item["Doer Name"]);
        setDoerName(DoerNameData);
        const giveBy = formattedRows.map((item) => item["Given By"]);
        setGivenByData(giveBy);
        const taskStatus = formattedRows.map((item) => item["Task Status"]);
        setTaskStatusData(taskStatus);
        const priority = formattedRows.map((item) => item["Priority"]);
        setPriorityData(priority);
        const department = formattedRows.map((item) => item["Department"]);
        setDepartmentData(department);
      } else {
        console.error("Server error:", result.message || result.error);
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoaderMasterSheetData(false);
    }
  };

  useEffect(() => {
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

  const uploadFileToDrive = async (file) => {
    const reader = new FileReader();

    return new Promise((resolve, reject) => {
      reader.onload = async () => {
        const base64Data = reader.result;

        try {
          const res = await fetch(SUBMIT_SCRIPT_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              action: "uploadFile",
              base64Data: base64Data,
              fileName: file.name,
              mimeType: file.type || "image/jpeg",
              folderId: FOLDER_ID,
            }).toString(),
          });

          const data = await res.json();

          console.log("FileUploadData:", data);

          if (data.success && data.fileUrl) {
            resolve(data.fileUrl);
          } else {
            console.error("File upload response error:", data);
            toast.error("❌ Image upload issue: " + (data.error || "Google Drive file permission"));
            resolve(data.fileUrl || "");
          }
        } catch (err) {
          console.error("Upload error:", err);
          toast.error("❌ Upload failed due to network error");
          resolve("");
        }
      };

      reader.onerror = () => {
        reject("❌ Failed to read file");
      };

      reader.readAsDataURL(file);
    });
  };

  const clearFormState = () => {
    setSelectedSerialNo("");
    setSelectedMachine("");
    setSelectedFirmName("");
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
        userManualUrl = await uploadFileToDrive(userManualFile);
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
        "Task Start Date": `${startDate} ${startTime}:00`,
        "Task Ending Date": `${endTaskDate} ${endTime}:00`,
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

      // Append all fields individually to formData
      Object.entries(taskData).forEach(([key, value]) => {
        formPayload.append(key, value);
      });

      // Submit to the correct sheet URL
      const response = await fetch(`${SUBMIT_SCRIPT_URL}?headerRow=5`, {
        method: "POST",
        body: formPayload,
      });

      const result = await response.json();
      
      if (result.success || response.ok) {
        toast.success("✅ Task assigned successfully!");
        
        // Clear form state
        clearFormState();
        
        // Call onSubmit to refresh the parent component's data
        if (onSubmit) {
          onSubmit();
        }
        
        // Close modal
        onCancel();
      } else {
        throw new Error(result.message || "Submission failed");
      }

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
        {/* Machine Name Dropdown */}
        <div>
          <label
            htmlFor="machineName"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Machine Name *
          </label>
          {isAddingMachine ? (
            <div className="flex gap-2">
              <input
                type="text"
                id="machineName"
                value={selectedMachine}
                onChange={(e) => setSelectedMachine(e.target.value)}
                placeholder="Enter new machine name"
                required
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => {
                  setIsAddingMachine(false);
                  setSelectedMachine("");
                  setFilteredSerials([]);
                  setIsAddingSerial(false);
                  setSelectedSerialNo("");
                }}
                className="text-sm text-blue-600 hover:text-blue-700 whitespace-nowrap"
              >
                Choose from list
              </button>
            </div>
          ) : (
            <select
              id="machineName"
              value={selectedMachine}
              onChange={(e) => {
                const selected = e.target.value;
                if (selected === "__add_new__") {
                  setIsAddingMachine(true);
                  setSelectedMachine("");
                  setFilteredSerials([]);
                  setIsAddingSerial(false);
                  setSelectedSerialNo("");
                  return;
                }
                setSelectedMachine(selected);
                const serials = sheetData
                  .filter((item) => item["Machine Name"] === selected)
                  .map((item) => item["Serial No"]);
                setFilteredSerials(serials);
              }}
              className="w-full py-2 rounded-md border border-gray-300 shadow-sm px-4 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Select Machine</option>
              {loaderSheetData ? (
                <option disabled>Wait Please...</option>
              ) : (
                <>
                  {[...new Set(sheetData.map((item) => item["Machine Name"]))]
                    .filter(Boolean)
                    .map((machineName, index) => (
                      <option key={index} value={machineName}>
                        {machineName}
                      </option>
                    ))}
                </>
              )}
              <option value="__add_new__">+ Add New</option>
            </select>
          )}
        </div>

        {/* Firm Name */}
        <div>
          <label
            htmlFor="firmName"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Firm Name *
          </label>
          <select
            id="firmName"
            value={selectedFirmName}
            onChange={(e) => setSelectedFirmName(e.target.value)}
            className={`py-2 w-full rounded-md border border-gray-300 shadow-sm px-4 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              user?.firmName && user.firmName.toLowerCase() !== "all" ? "bg-gray-100 cursor-not-allowed" : ""
            }`}
            disabled={user?.firmName && user.firmName.toLowerCase() !== "all"}
            required
          >
            <option value="">Select Firm Name</option>
            {["Pmmpl", "Purab", "Rkl", "Refrasynth", "Refratech"].map((firm, index) => (
              <option key={index} value={firm}>
                {firm}
              </option>
            ))}
          </select>
        </div>

        {/* Serial No Related to Machine Name */}
        {selectedMachine && !loaderSheetData && (
          <div className="">
            <label
              htmlFor="serialNo"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Serial Number *
            </label>
            {isAddingMachine || isAddingSerial ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  id="serialNo"
                  value={selectedSerialNo}
                  onChange={(e) => setSelectedSerialNo(e.target.value)}
                  placeholder="Enter serial number"
                  required
                  autoFocus={!isAddingMachine}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {!isAddingMachine && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingSerial(false);
                      setSelectedSerialNo("");
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700 whitespace-nowrap"
                  >
                    Choose from list
                  </button>
                )}
              </div>
            ) : (
              <select
                id="serialNo"
                value={selectedSerialNo}
                onChange={(e) => {
                  if (e.target.value === "__add_new__") {
                    setIsAddingSerial(true);
                    setSelectedSerialNo("");
                    return;
                  }
                  setSelectedSerialNo(e.target.value);

                  const department = sheetData
                    .filter((item) => item["Serial No"] === e.target.value)
                    .map((item) => item["Department"]);
                  setFilteredDepartment(department);

                  const location = sheetData
                    .filter((item) => item["Serial No"] === e.target.value)
                    .map((item) => item["Location"]);
                }}
                className="py-2 w-full rounded-md border border-gray-300 shadow-sm px-4 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select Serial No</option>
                {filteredSerials.map((serial, idx) => (
                  <option key={idx} value={serial}>
                    {serial}
                  </option>
                ))}
                <option value="__add_new__">+ Add New</option>
              </select>
            )}
          </div>
        )}

        {/* Indentor Name */}
        <AddNewSelect
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
        <AddNewSelect
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
        <AddNewSelect
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* UOM */}
        <div>
          <label htmlFor="uom" className="block text-sm font-medium text-gray-700 mb-2">
            UOM
          </label>
          <input
            type="text"
            id="uom"
            name="uom"
            value={uom}
            onChange={(e) => setUom(e.target.value)}
            placeholder="Enter UOM (e.g. Nos, Pcs, Set, Kg)"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Priority */}
        <AddNewSelect
          id="priority"
          label="Priority"
          value={selectedPriority}
          onChange={setSelectedPriority}
          options={priorityData}
          loading={loaderMasterSheetData}
          isAdding={isAddingPriority}
          setIsAdding={setIsAddingPriority}
        />

        {/* Start Date */}
        <div>
          <label
            htmlFor="startDate"
            className="block text-sm font-medium text-gray-700"
          >
            Task Start Date
          </label>
          <input
            type="date"
            id="startDate"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
          />
        </div>

        {/* Task Start Time */}
        <div>
          <label
            htmlFor="startTime"
            className="block text-sm font-medium text-gray-700"
          >
            Task Start Time
          </label>
          <input
            type="time"
            id="startTime"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
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
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
          />
        </div>

        {/* Task End Time */}
        <div>
          <label
            htmlFor="endTime"
            className="block text-sm font-medium text-gray-700"
          >
            Task End Time
          </label>
          <input
            type="time"
            id="endTime"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
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
          className="w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* upload Image */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Image of the Machine
        </label>
        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-blue-400 transition-colors duration-200">
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
        <label className="flex items-center">
          <input
            type="checkbox"
            name="enableReminders"
            checked={enableReminder}
            onChange={() => setEnableReminder((prev) => !prev)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <span className="ml-2 text-sm text-gray-700">Enable Reminders</span>
        </label>

        <label className="flex items-center">
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