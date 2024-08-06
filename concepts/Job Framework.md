# Job Framework

## Job Steps:
1. Job Steps are the building blocks of a job. Each job flow must contain at least one step.
2. The Job Framework includes preconfigured system steps that do not require coding for common processes.
3. If a system step does not meet your requirements, developers can create custom job steps to tailor the job to specific needs.
4. System job steps are available for various tasks like importing/exporting data, replicating data, or building search indexes.
## Locking System Resources:
1. When creating a job, you can prevent other jobs from modifying system resources while your job is executing.
2. Assign system resources related to the entities your job interacts with to prevent unexpected outcomes due to simultaneous modifications by other jobs.
## Job Flows:
1. A flow controls the sequence in which job steps are executed within a job.
2. Every job must contain at least one flow, and each flow must have at least one step.
3. Flows can have different scopes, such as the entire organization, specific storefront sites, or sites passed to the job at execution time using the OCAPI data API.
## Creating and Managing Jobs:
1. Use Business Manager to create jobs in Salesforce Commerce Cloud.
2. The new job framework is recommended for creating and managing jobs, but legacy functionality is also available.
3. Jobs can be run manually as needed or scheduled to run at specific times or on a recurring basis.
## Job Parameter:
1. You can create job parameters to use in different job steps, allowing for flexibility and reusability.
2. Modifying the value of a job parameter updates all steps that include the parameter with the new value.
## Migration of Legacy Jobs:
1. To take advantage of the benefits of the new job framework, it is recommended to migrate legacy pipeline-based custom jobs to step-based jobs.
2. The migration process involves creating a new custom job with the same details as the legacy job and logging the migration for reference.